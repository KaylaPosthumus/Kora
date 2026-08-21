import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserRole } from "../../types/common";

/**
 * Smoke tests for the auth flow (phase 2 of NEXT_MIGRATION_PLAN).
 *
 * The migration kept the old .NET service's numeric result contract
 * (200 ok / 300 signed-in-but-unlinked / 4xx-5xx failure) so the auth screens
 * did not have to change. That contract is the thing worth pinning: the screens
 * branch on these codes, and a Firebase error code leaking through unmapped
 * would show a raw `auth/...` string to a user.
 */

const authState: { currentUser: unknown } = { currentUser: null };
/** `users/{uid}` docs, keyed by uid. */
let userDocs: Record<string, unknown>;
/** Where redirectForUser sent the browser. */
let navigatedTo: string[];

vi.mock("../firebase", () => ({
  auth: authState,
  db: { __fake: "db" },
  storage: {},
  googleProvider: {},
}));

/** Loose signature so the spread-through wrappers below typecheck. */
type AnyAsyncFn = (...args: any[]) => Promise<any>;

const signInWithEmailAndPassword = vi.fn<AnyAsyncFn>();
const signInWithPopup = vi.fn<AnyAsyncFn>();
const createUserWithEmailAndPassword = vi.fn<AnyAsyncFn>();
const sendEmailVerification = vi.fn<AnyAsyncFn>(async () => undefined);
const updateProfile = vi.fn<AnyAsyncFn>(async () => undefined);
const signOut = vi.fn<AnyAsyncFn>(async () => undefined);

vi.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: (...a: unknown[]) => signInWithEmailAndPassword(...a),
  signInWithPopup: (...a: unknown[]) => signInWithPopup(...a),
  createUserWithEmailAndPassword: (...a: unknown[]) => createUserWithEmailAndPassword(...a),
  sendEmailVerification: (...a: unknown[]) => sendEmailVerification(...a),
  updateProfile: (...a: unknown[]) => updateProfile(...a),
  signOut: (...a: unknown[]) => signOut(...a),
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    // Firebase always invokes the observer asynchronously; calling it inline
    // would run the callback before `unsubscribe` is assigned.
    queueMicrotask(() => cb(authState.currentUser));
    return () => undefined;
  },
  GoogleAuthProvider: class {
    setCustomParameters(): void {
      return undefined;
    }
  },
}));

const setDoc = vi.fn<AnyAsyncFn>(async () => undefined);

vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, _col: string, uid: string) => ({ uid }),
  getDoc: async (ref: { uid: string }) => {
    const data = userDocs[ref.uid];
    return { exists: () => data !== undefined, data: () => data };
  },
  setDoc: (...a: unknown[]) => setDoc(...a),
  serverTimestamp: () => "SERVER_TS",
  getFirestore: () => ({}),
}));

/** A signed-in Firebase user. */
const firebaseUser = (uid = "uid1", overrides: Record<string, unknown> = {}) => ({
  uid,
  email: "someone@kora.test",
  displayName: "Someone",
  photoURL: null,
  emailVerified: true,
  ...overrides,
});

/** Fresh module instance — authService caches the user doc at module scope. */
const loadAuthService = async () => {
  vi.resetModules();
  return import("../authService");
};

beforeEach(() => {
  authState.currentUser = null;
  userDocs = {};
  navigatedTo = [];
  signInWithEmailAndPassword.mockReset();
  signInWithPopup.mockReset();
  setDoc.mockClear();

  // jsdom refuses real navigation; capture the assignment instead.
  delete (window as { location?: unknown }).location;
  (window as { location: unknown }).location = {
    set href(value: string) {
      navigatedTo.push(value);
    },
    get href() {
      return navigatedTo[navigatedTo.length - 1] ?? "";
    },
  };
});

describe("fullEmailLogin", () => {
  it("sends a linked admin to the admin dashboard with a 200", async () => {
    const user = firebaseUser("admin-uid");
    authState.currentUser = user;
    userDocs["admin-uid"] = {
      fullName: "Ada Admin",
      email: "ada@kora.test",
      role: UserRole.Admin,
      isLinked: true,
      adminId: "admin1",
      employeeId: null,
    };
    signInWithEmailAndPassword.mockResolvedValue({ user });

    const { fullEmailLogin } = await loadAuthService();
    const result = await fullEmailLogin("ada@kora.test", "pw");

    expect(result.errorCode).toBe(200);
    expect(navigatedTo).toContain("/admin/dashboard");
  });

  it("sends a linked employee to the employee home with a 200", async () => {
    const user = firebaseUser("emp-uid");
    authState.currentUser = user;
    userDocs["emp-uid"] = {
      fullName: "Eli Employee",
      email: "eli@kora.test",
      role: UserRole.Employee,
      isLinked: true,
      adminId: null,
      employeeId: "emp1",
    };
    signInWithEmailAndPassword.mockResolvedValue({ user });

    const { fullEmailLogin } = await loadAuthService();
    const result = await fullEmailLogin("eli@kora.test", "pw");

    expect(result.errorCode).toBe(200);
    expect(navigatedTo).toContain("/employee/home");
  });

  it("returns 300 and the notlinked route for an unlinked account", async () => {
    const user = firebaseUser("new-uid");
    authState.currentUser = user;
    userDocs["new-uid"] = {
      fullName: "Nia New",
      email: "nia@kora.test",
      role: UserRole.Unassigned,
      isLinked: false,
      adminId: null,
      employeeId: null,
    };
    signInWithEmailAndPassword.mockResolvedValue({ user });

    const { fullEmailLogin } = await loadAuthService();
    const result = await fullEmailLogin("nia@kora.test", "pw");

    // 300 is the code the login screen keys the "not linked yet" notice off.
    expect(result.errorCode).toBe(300);
    expect(navigatedTo).toContain("/#notlinked");
  });

  it("returns 403 for a linked account with neither an adminId nor an employeeId", async () => {
    const user = firebaseUser("odd-uid");
    authState.currentUser = user;
    userDocs["odd-uid"] = {
      fullName: "Odd One",
      email: "odd@kora.test",
      role: UserRole.Unassigned,
      isLinked: true,
      adminId: null,
      employeeId: null,
    };
    signInWithEmailAndPassword.mockResolvedValue({ user });

    const { fullEmailLogin } = await loadAuthService();
    expect((await fullEmailLogin("odd@kora.test", "pw")).errorCode).toBe(403);
  });

  it("does not read the user doc when the credentials are rejected", async () => {
    signInWithEmailAndPassword.mockRejectedValue({ code: "auth/invalid-credential" });

    const { fullEmailLogin } = await loadAuthService();
    const result = await fullEmailLogin("ada@kora.test", "wrong");

    expect(result.errorCode).toBe(401);
    expect(result.message).toBe("Incorrect email or password");
    expect(navigatedTo).toHaveLength(0);
  });
});

describe("Firebase auth error mapping", () => {
  const cases: Array<[string, number]> = [
    ["auth/invalid-credential", 401],
    ["auth/wrong-password", 401],
    ["auth/user-not-found", 401],
    ["auth/email-already-in-use", 409],
    ["auth/weak-password", 400],
    ["auth/invalid-email", 400],
    ["auth/popup-closed-by-user", 499],
    ["auth/cancelled-popup-request", 499],
    ["auth/too-many-requests", 429],
  ];

  it.each(cases)("maps %s to %i", async (code, expected) => {
    signInWithEmailAndPassword.mockRejectedValue({ code });
    const { loginWithEmail } = await loadAuthService();

    const result = await loginWithEmail("a@b.test", "pw");
    expect(result.errorCode).toBe(expected);
    // Never leak the raw Firebase code to the screen.
    expect(result.message).not.toContain("auth/");
  });

  it("falls back to 500 for an unrecognised code", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    signInWithEmailAndPassword.mockRejectedValue({ code: "auth/internal-error" });
    const { loginWithEmail } = await loadAuthService();

    expect((await loginWithEmail("a@b.test", "pw")).errorCode).toBe(500);
  });
});

describe("getCurrentUser", () => {
  it("returns null when nobody is signed in", async () => {
    authState.currentUser = null;
    const { getCurrentUser } = await loadAuthService();
    expect(await getCurrentUser()).toBeNull();
  });

  it("treats a signed-in user with no profile doc as unlinked rather than erroring", async () => {
    authState.currentUser = firebaseUser("ghost-uid", { displayName: "Ghost" });
    const { getCurrentUser } = await loadAuthService();

    const user = await getCurrentUser();

    expect(user).toMatchObject({
      userId: "ghost-uid",
      fullName: "Ghost",
      role: UserRole.Unassigned,
      isLinked: false,
    });
  });

  it("caches the profile doc until it is invalidated", async () => {
    authState.currentUser = firebaseUser("emp-uid");
    userDocs["emp-uid"] = {
      fullName: "Before",
      email: "eli@kora.test",
      role: UserRole.Employee,
      isLinked: true,
      employeeId: "emp1",
    };
    const { getCurrentUser, invalidateCurrentUser } = await loadAuthService();

    expect((await getCurrentUser())?.fullName).toBe("Before");

    userDocs["emp-uid"] = { ...(userDocs["emp-uid"] as object), fullName: "After" };
    expect((await getCurrentUser())?.fullName).toBe("Before");

    invalidateCurrentUser();
    expect((await getCurrentUser())?.fullName).toBe("After");
  });
});

describe("checkIfUserIsLinked", () => {
  it("re-reads the doc so a just-linked account is picked up without a re-login", async () => {
    authState.currentUser = firebaseUser("emp-uid");
    userDocs["emp-uid"] = {
      fullName: "Eli Employee",
      email: "eli@kora.test",
      role: UserRole.Employee,
      isLinked: false,
      employeeId: null,
    };
    const { getCurrentUser, checkIfUserIsLinked } = await loadAuthService();

    // Prime the cache with the unlinked doc, as the notlinked screen does.
    expect((await getCurrentUser())?.isLinked).toBe(false);

    // An admin links them while that screen is open.
    userDocs["emp-uid"] = {
      ...(userDocs["emp-uid"] as object),
      isLinked: true,
      employeeId: "emp1",
    };

    const result = await checkIfUserIsLinked();

    expect(result.errorCode).toBe(200);
    expect(navigatedTo).toContain("/employee/home");
  });

  it("returns 400 and stays on the notlinked route while still unlinked", async () => {
    authState.currentUser = firebaseUser("new-uid");
    userDocs["new-uid"] = {
      fullName: "Nia New",
      email: "nia@kora.test",
      role: UserRole.Unassigned,
      isLinked: false,
    };
    const { checkIfUserIsLinked } = await loadAuthService();

    expect((await checkIfUserIsLinked()).errorCode).toBe(400);
    expect(navigatedTo).toContain("/#notlinked");
  });
});

describe("fullGoogleSignIn", () => {
  it("creates an unassigned profile on a first sign-in and reports 300", async () => {
    const user = firebaseUser("g-uid", { displayName: "Gina Google" });
    authState.currentUser = user;
    signInWithPopup.mockResolvedValue({ user });
    // No users/g-uid doc yet.

    const { fullGoogleSignIn } = await loadAuthService();
    const result = await fullGoogleSignIn();

    expect(setDoc).toHaveBeenCalledTimes(1);
    const written = setDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(written).toMatchObject({
      fullName: "Gina Google",
      role: UserRole.Unassigned,
      isLinked: false,
      // Explicit nulls — the create rule reads these keys and a missing key
      // makes rule evaluation error out, which Firestore treats as a denial.
      employeeId: null,
      adminId: null,
    });
    expect(result.errorCode).toBe(300);
  });

  it("does not overwrite the profile of a returning Google user", async () => {
    const user = firebaseUser("g-uid");
    authState.currentUser = user;
    signInWithPopup.mockResolvedValue({ user });
    userDocs["g-uid"] = {
      fullName: "Gina Google",
      email: "gina@kora.test",
      role: UserRole.Admin,
      isLinked: true,
      adminId: "admin1",
    };

    const { fullGoogleSignIn } = await loadAuthService();
    const result = await fullGoogleSignIn();

    expect(setDoc).not.toHaveBeenCalled();
    expect(result.errorCode).toBe(200);
    expect(navigatedTo).toContain("/admin/dashboard");
  });

  it("maps a closed popup to 499 rather than an error", async () => {
    signInWithPopup.mockRejectedValue({ code: "auth/popup-closed-by-user" });
    const { fullGoogleSignIn } = await loadAuthService();

    expect((await fullGoogleSignIn()).errorCode).toBe(499);
  });
});
