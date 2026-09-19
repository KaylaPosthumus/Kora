import { describe, it, expect, beforeEach, vi } from "vitest";
import { firestoreMock } from "@/test/firestore";

/**
 * Unit tests for the writes that have to touch two documents at once.
 *
 * There are no joins, so fields that appear in a *list* are copied onto the
 * listed document: an employee row carries `fullName`/`email`/`profilePicture`
 * from the user doc. That copy is only correct while both sides move together,
 * and `updateEmpUserById` is the function CLAUDE.md points at as the example to
 * follow — so what it mirrors, and what it deliberately does not, is worth
 * pinning.
 *
 * These run against the in-memory Firestore double rather than per-call stubs,
 * so the assertions read the resulting documents instead of inspecting mock
 * calls.
 */

vi.mock("firebase/firestore", async () => (await import("@/test/firestore")).firestoreModule());
vi.mock("@/services/firebase", async () => (await import("@/test/firebaseApp")).firebaseAppModule());

const USER_PATH = "users/uid1";
const EMPLOYEE_PATH = "employees/emp1";

const seedLinkedEmployee = () => {
  firestoreMock.seed({
    [USER_PATH]: {
      fullName: "Eli Employee",
      email: "eli@kora.test",
      profilePicture: "https://cdn.test/eli.png",
      role: "employee",
      isLinked: true,
      employeeId: "emp1",
      adminId: null,
    },
    [EMPLOYEE_PATH]: {
      userId: "uid1",
      // Denormalised copies of the three user-owned fields.
      fullName: "Eli Employee",
      email: "eli@kora.test",
      profilePicture: "https://cdn.test/eli.png",
      jobTitle: "Designer",
      department: "Product",
      salaryAmount: 45000,
      isSuspended: false,
    },
  });
};

beforeEach(() => {
  firestoreMock.reset();
});

describe("updateEmpUserById", () => {
  it("mirrors a name change onto the user doc as well as the employee doc", async () => {
    seedLinkedEmployee();
    const { empUserAPI } = await import("@/features/employees/api/employeesApi");

    await empUserAPI.updateEmpUserById("emp1", { fullName: "Eli Employee-Smith" });

    expect(firestoreMock.get(EMPLOYEE_PATH)?.fullName).toBe("Eli Employee-Smith");
    // Without this the employee list shows the new name and the login header
    // shows the old one.
    expect(firestoreMock.get(USER_PATH)?.fullName).toBe("Eli Employee-Smith");
  });

  it("mirrors email and profile picture too", async () => {
    seedLinkedEmployee();
    const { empUserAPI } = await import("@/features/employees/api/employeesApi");

    await empUserAPI.updateEmpUserById("emp1", {
      email: "eli.smith@kora.test",
      profilePicture: "https://cdn.test/new.png",
    });

    expect(firestoreMock.get(USER_PATH)).toMatchObject({
      email: "eli.smith@kora.test",
      profilePicture: "https://cdn.test/new.png",
    });
  });

  it("does not copy employment fields onto the user doc", async () => {
    seedLinkedEmployee();
    const { empUserAPI } = await import("@/features/employees/api/employeesApi");

    await empUserAPI.updateEmpUserById("emp1", { salaryAmount: 60000, jobTitle: "Lead" });

    expect(firestoreMock.get(EMPLOYEE_PATH)?.salaryAmount).toBe(60000);
    // The whole point of the rules split: a salary must never land on a doc
    // every signed-in user can read.
    expect(firestoreMock.get(USER_PATH)).not.toHaveProperty("salaryAmount");
    expect(firestoreMock.get(USER_PATH)).not.toHaveProperty("jobTitle");
  });

  it("writes both documents in a single batch", async () => {
    seedLinkedEmployee();
    const { empUserAPI } = await import("@/features/employees/api/employeesApi");

    await empUserAPI.updateEmpUserById("emp1", { fullName: "Eli Employee-Smith" });

    // Two updates, no read-modify-write in between — a partial commit would
    // leave the two copies disagreeing.
    expect(firestoreMock.writes().map((write) => write.path)).toEqual([
      EMPLOYEE_PATH,
      USER_PATH,
    ]);
  });

  it("skips the user write when nothing user-owned changed", async () => {
    seedLinkedEmployee();
    const { empUserAPI } = await import("@/features/employees/api/employeesApi");

    await empUserAPI.updateEmpUserById("emp1", { department: "Platform" });

    expect(firestoreMock.writes().map((write) => write.path)).toEqual([EMPLOYEE_PATH]);
  });

  it("updates the employee doc even when it has no linked user", async () => {
    firestoreMock.seed({
      [EMPLOYEE_PATH]: { userId: null, fullName: "Placeholder", jobTitle: "Designer" },
    });
    const { empUserAPI } = await import("@/features/employees/api/employeesApi");

    const response = await empUserAPI.updateEmpUserById("emp1", { fullName: "Renamed" });

    expect(response.status).toBe(200);
    expect(firestoreMock.get(EMPLOYEE_PATH)?.fullName).toBe("Renamed");
  });

  it("returns 404 and writes nothing for an unknown employee", async () => {
    const { empUserAPI } = await import("@/features/employees/api/employeesApi");

    const response = await empUserAPI.updateEmpUserById("nope", { fullName: "Ghost" });

    expect(response.status).toBe(404);
    expect(firestoreMock.writes()).toHaveLength(0);
  });
});

describe("terminateEmpById", () => {
  const seedForTermination = () => {
    seedLinkedEmployee();
    firestoreMock.seed({
      "employees/emp1/leaveBalances/annual": { leaveTypeId: "annual", remainingDays: 7 },
      "employees/emp1/leaveBalances/sick": { leaveTypeId: "sick", remainingDays: 10 },
      "equipment/laptop1": {
        equipmentName: "MacBook Pro",
        employeeId: "emp1",
        assignedDate: "2026-01-05T00:00:00.000Z",
      },
      "equipment/spare1": { equipmentName: "Spare Monitor", employeeId: null, assignedDate: null },
    });
  };

  it("returns the terminated employee's equipment to the unassigned pool", async () => {
    seedForTermination();
    const { employeeAPI } = await import("@/features/employees/api/employeesApi");

    await employeeAPI.terminateEmpById("emp1");

    expect(firestoreMock.get("equipment/laptop1")).toMatchObject({
      employeeId: null,
      assignedDate: null,
    });
    // Their record is gone, so equipment left pointing at it would be
    // unreachable from either screen.
    expect(firestoreMock.get(EMPLOYEE_PATH)).toBeUndefined();
  });

  it("does not touch equipment belonging to nobody", async () => {
    seedForTermination();
    const { employeeAPI } = await import("@/features/employees/api/employeesApi");

    await employeeAPI.terminateEmpById("emp1");

    expect(firestoreMock.writes().some((write) => write.path === "equipment/spare1")).toBe(false);
  });

  it("deletes the leave balance subcollection", async () => {
    seedForTermination();
    const { employeeAPI } = await import("@/features/employees/api/employeesApi");

    await employeeAPI.terminateEmpById("emp1");

    // Firestore does not cascade — an undeleted subcollection would survive as
    // an orphan under a path with no parent document.
    expect(firestoreMock.pathsIn("employees/emp1/leaveBalances")).toEqual([]);
  });

  it("unlinks the user account instead of deleting it", async () => {
    seedForTermination();
    const { employeeAPI } = await import("@/features/employees/api/employeesApi");

    await employeeAPI.terminateEmpById("emp1");

    // The person can still sign in; they land on the not-linked screen. Deleting
    // the doc would strand the Firebase Auth account with no profile at all.
    expect(firestoreMock.get(USER_PATH)).toMatchObject({ isLinked: false, employeeId: null });
    expect(firestoreMock.get(USER_PATH)?.email).toBe("eli@kora.test");
  });

  it("returns 404 and writes nothing for an unknown employee", async () => {
    const { employeeAPI } = await import("@/features/employees/api/employeesApi");

    expect((await employeeAPI.terminateEmpById("nope")).status).toBe(404);
    expect(firestoreMock.writes()).toHaveLength(0);
  });
});
