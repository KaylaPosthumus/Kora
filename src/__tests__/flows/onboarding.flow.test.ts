import { describe, it, expect, beforeEach, vi } from "vitest";
import { firestoreMock } from "@/test/firestore";
import { authMock } from "@/test/firebaseApp";
import { captureNavigation } from "@/test/navigation";
import { UserRole } from "@/shared/types/common";

/**
 * Flow test — signing up, waiting to be linked, and being granted a role.
 *
 * This is the app's privilege boundary end to end. A signup can never grant its
 * own role (`firestore.rules` rejects it, and `authService` never asks for one),
 * so a new account is inert until an admin links it. Every step below is a real
 * call into `authService` or a feature API module against the in-memory Firestore —
 * nothing between them is stubbed, so a change that breaks the handover from one
 * step to the next fails here rather than in production.
 *
 * The unit tests in `src/services/__tests__` already cover each function on its
 * own. What they cannot see is the seam: that the doc `employeeSignUp` writes is
 * the doc `setupUserAsEmployee` reads, and that the login which returned 300
 * before linking returns 200 after it.
 */

vi.mock("firebase/firestore", async () => (await import("@/test/firestore")).firestoreModule());
vi.mock("firebase/auth", async () => (await import("@/test/firebaseApp")).firebaseAuthModule());
vi.mock("@/services/firebase", async () => (await import("@/test/firebaseApp")).firebaseAppModule());

const navigation = captureNavigation();

/** The leave types every new employee gets an allowance of. */
const seedLeaveTypes = () => {
  firestoreMock.seed({
    "leaveTypes/annual": {
      leaveTypeName: "Annual",
      description: "Annual leave",
      defaultDays: 15,
    },
    "leaveTypes/sick": { leaveTypeName: "Sick", description: "Sick leave", defaultDays: 10 },
  });
};

const employmentDetails = {
  gender: "female",
  dateOfBirth: "1995-04-02",
  phoneNumber: "0821234567",
  jobTitle: "Designer",
  department: "Product",
  salaryAmount: 45000,
  payCycle: "monthly",
  employType: "full-time",
  employDate: "2026-02-01",
};

const signupForm = {
  fullName: "Nadia New",
  email: "nadia@kora.test",
  password: "Password123!",
};

beforeEach(() => {
  firestoreMock.reset();
  authMock.reset();
  navigation.reset();
  // authService caches users/{uid} at module scope; a fresh module per test
  // keeps one test's cached user out of the next one.
  vi.resetModules();
});

describe("employee onboarding", () => {
  it("takes a new signup from unlinked to working employee", async () => {
    seedLeaveTypes();
    const { employeeSignUp, fullEmailLogin, checkIfUserIsLinked } = await import(
      "@/services/authService"
    );
    const { userAPI, employeeAPI } = await import("@/features/employees/api/employeesApi");

    // 1. They sign up on /employee/signup.
    expect((await employeeSignUp(signupForm)).errorCode).toBe(200);

    const uid = authMock.currentUser()!.uid;
    expect(firestoreMock.get(`users/${uid}`)).toMatchObject({
      role: UserRole.Unassigned,
      requestedRole: UserRole.Employee,
      isLinked: false,
      employeeId: null,
      adminId: null,
    });

    // 2. Logging in works, but lands them on the "not linked" screen.
    const blocked = await fullEmailLogin(signupForm.email, signupForm.password);
    expect(blocked.errorCode).toBe(300);
    expect(navigation.last()).toBe("/#notlinked");

    // 3. The admin sees them in the unlinked queue.
    const unlinked = await userAPI.getUnlinkedUsers();
    expect(unlinked.data).toHaveLength(1);
    expect(unlinked.data[0]).toMatchObject({
      email: signupForm.email,
      requestedRole: UserRole.Employee,
    });

    // 4. The admin creates their employee record.
    const linked = await employeeAPI.setupUserAsEmployee({
      userId: uid,
      ...employmentDetails,
    });
    expect(linked.status).toBe(201);
    const employeeId = linked.data.employeeId;

    // 5. The same account is now an employee, and the screens can find it.
    navigation.reset();
    const check = await checkIfUserIsLinked();
    expect(check.errorCode).toBe(200);
    expect(navigation.last()).toBe("/employee/home");

    // 6. And a fresh login goes straight there.
    navigation.reset();
    const allowed = await fullEmailLogin(signupForm.email, signupForm.password);
    expect(allowed.errorCode).toBe(200);
    expect(navigation.last()).toBe("/employee/home");

    expect(firestoreMock.get(`users/${uid}`)).toMatchObject({
      role: UserRole.Employee,
      isLinked: true,
      employeeId,
    });
  });

  it("seeds one leave balance per leave type, keyed by the leave type id", async () => {
    seedLeaveTypes();
    const { employeeSignUp } = await import("@/services/authService");
    const { employeeAPI } = await import("@/features/employees/api/employeesApi");

    await employeeSignUp(signupForm);
    const uid = authMock.currentUser()!.uid;
    const { data } = await employeeAPI.setupUserAsEmployee({ userId: uid, ...employmentDetails });

    // The document id *is* the leave type id — that is what lets
    // approve-and-decrement read the balance directly inside a transaction,
    // which cannot run a query. Keying these any other way breaks approvals.
    expect(firestoreMock.pathsIn(`employees/${data.employeeId}/leaveBalances`)).toEqual([
      `employees/${data.employeeId}/leaveBalances/annual`,
      `employees/${data.employeeId}/leaveBalances/sick`,
    ]);

    expect(
      firestoreMock.get(`employees/${data.employeeId}/leaveBalances/annual`)
    ).toMatchObject({
      leaveTypeId: "annual",
      leaveTypeName: "Annual",
      defaultDays: 15,
      // Everyone starts on a full allowance.
      remainingDays: 15,
    });
  });

  it("copies the user's name and email onto the employee record for list reads", async () => {
    seedLeaveTypes();
    const { employeeSignUp } = await import("@/services/authService");
    const { employeeAPI, empUserAPI } = await import("@/features/employees/api/employeesApi");

    await employeeSignUp(signupForm);
    const uid = authMock.currentUser()!.uid;
    const { data } = await employeeAPI.setupUserAsEmployee({ userId: uid, ...employmentDetails });

    // There are no joins, so the admin employee list renders off this copy.
    expect(firestoreMock.get(`employees/${data.employeeId}`)).toMatchObject({
      fullName: signupForm.fullName,
      email: signupForm.email,
      userId: uid,
    });

    const listed = await empUserAPI.getAllEmpUsers();
    expect(listed.data.map((employee) => employee.fullName)).toEqual([signupForm.fullName]);
  });

  it("assigns chosen equipment as part of linking, in the same batch", async () => {
    seedLeaveTypes();
    firestoreMock.seed({
      "equipment/laptop1": { equipmentName: "MacBook Pro", employeeId: null, assignedDate: null },
    });
    const { employeeSignUp } = await import("@/services/authService");
    const { employeeAPI } = await import("@/features/employees/api/employeesApi");

    await employeeSignUp(signupForm);
    const uid = authMock.currentUser()!.uid;
    const { data } = await employeeAPI.setupUserAsEmployee({
      userId: uid,
      ...employmentDetails,
      equipmentIds: ["laptop1"],
    });

    const laptop = firestoreMock.get("equipment/laptop1");
    expect(laptop?.employeeId).toBe(data.employeeId);
    expect(laptop?.assignedDate).toEqual(expect.any(String));
  });

  it("leaves the account untouched when linking fails part-way", async () => {
    seedLeaveTypes();
    const { employeeSignUp } = await import("@/services/authService");
    const { employeeAPI } = await import("@/features/employees/api/employeesApi");

    await employeeSignUp(signupForm);
    const uid = authMock.currentUser()!.uid;

    // Equipment that was deleted between the form loading and being submitted.
    await expect(
      employeeAPI.setupUserAsEmployee({
        userId: uid,
        ...employmentDetails,
        equipmentIds: ["deleted-laptop"],
      })
    ).rejects.toThrow();

    // The batch is atomic, so a half-linked user — role granted with no employee
    // record — must not be possible.
    expect(firestoreMock.get(`users/${uid}`)).toMatchObject({
      role: UserRole.Unassigned,
      isLinked: false,
    });
    expect(firestoreMock.pathsIn("employees")).toEqual([]);
  });

  it("refuses to link a user id that does not exist", async () => {
    seedLeaveTypes();
    const { employeeAPI } = await import("@/features/employees/api/employeesApi");

    await expect(
      employeeAPI.setupUserAsEmployee({ userId: "ghost", ...employmentDetails })
    ).rejects.toThrow(/No user found/);
    expect(firestoreMock.pathsIn("employees")).toEqual([]);
  });
});

describe("admin onboarding", () => {
  it("grants the admin role only at link time, never at signup", async () => {
    const { adminSignUp, fullEmailLogin } = await import("@/services/authService");
    const { linkUserAsAdmin } = await import("@/features/employees/api/employeesApi");

    await adminSignUp({ ...signupForm, email: "ada@kora.test" });
    const uid = authMock.currentUser()!.uid;

    // /admin/signup is a public route. If the signup wrote role: "admin", anyone
    // who found the URL would get read access to every salary in the company.
    expect(firestoreMock.get(`users/${uid}`)?.role).toBe(UserRole.Unassigned);
    expect(firestoreMock.get(`users/${uid}`)?.requestedRole).toBe(UserRole.Admin);
    expect((await fullEmailLogin("ada@kora.test", signupForm.password)).errorCode).toBe(300);

    const { data } = await linkUserAsAdmin(uid);

    expect(firestoreMock.get(`users/${uid}`)).toMatchObject({
      role: UserRole.Admin,
      isLinked: true,
      adminId: data.adminId,
    });
    expect(firestoreMock.get(`admins/${data.adminId}`)).toMatchObject({
      userId: uid,
      email: "ada@kora.test",
    });

    navigation.reset();
    const allowed = await fullEmailLogin("ada@kora.test", signupForm.password);
    expect(allowed.errorCode).toBe(200);
    expect(navigation.last()).toBe("/admin/dashboard");
  });
});

describe("Google sign-in onboarding", () => {
  it("creates an unassigned profile on the first sign-in and links on the second", async () => {
    seedLeaveTypes();
    const { fullGoogleSignIn, checkIfUserIsLinked } = await import("@/services/authService");
    const { employeeAPI } = await import("@/features/employees/api/employeesApi");

    authMock.nextPopupUser({
      uid: "google-uid",
      email: "gina@kora.test",
      displayName: "Gina Google",
    });

    expect((await fullGoogleSignIn()).errorCode).toBe(300);
    expect(firestoreMock.get("users/google-uid")).toMatchObject({
      fullName: "Gina Google",
      role: UserRole.Unassigned,
      isLinked: false,
    });

    await employeeAPI.setupUserAsEmployee({ userId: "google-uid", ...employmentDetails });

    navigation.reset();
    expect((await checkIfUserIsLinked()).errorCode).toBe(200);
    expect(navigation.last()).toBe("/employee/home");
  });

  it("does not overwrite an existing profile when a linked user signs in again", async () => {
    const { fullGoogleSignIn } = await import("@/services/authService");

    authMock.nextPopupUser({ uid: "google-uid", email: "gina@kora.test", displayName: "Gina" });
    firestoreMock.seed({
      "users/google-uid": {
        fullName: "Gina Google",
        email: "gina@kora.test",
        role: UserRole.Admin,
        isLinked: true,
        adminId: "admin1",
        employeeId: null,
      },
    });

    expect((await fullGoogleSignIn()).errorCode).toBe(200);
    expect(navigation.last()).toBe("/admin/dashboard");
    // A blind setDoc here would demote an admin back to unassigned on every
    // Google login.
    expect(firestoreMock.get("users/google-uid")?.role).toBe(UserRole.Admin);
    expect(firestoreMock.writes()).toHaveLength(0);
  });
});

describe("termination", () => {
  it("returns a terminated employee to the not-linked screen without deleting the account", async () => {
    seedLeaveTypes();
    const { employeeSignUp, fullEmailLogin } = await import("@/services/authService");
    const { employeeAPI } = await import("@/features/employees/api/employeesApi");

    await employeeSignUp(signupForm);
    const uid = authMock.currentUser()!.uid;
    const { data } = await employeeAPI.setupUserAsEmployee({ userId: uid, ...employmentDetails });

    await employeeAPI.terminateEmpById(data.employeeId);

    navigation.reset();
    const result = await fullEmailLogin(signupForm.email, signupForm.password);

    // They can still sign in — the Firebase Auth account is untouched — but the
    // app treats them as unlinked again.
    expect(result.errorCode).toBe(300);
    expect(navigation.last()).toBe("/#notlinked");
    expect(firestoreMock.get(`employees/${data.employeeId}`)).toBeUndefined();
  });
});
