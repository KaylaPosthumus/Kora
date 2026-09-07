import { describe, it, expect, beforeEach } from "vitest";

import {
  UID_KEYED_COLLECTIONS,
  cleanUpDeletedUser,
  type UserCleanupBackend,
} from "../userCleanup";

const fakeBackend = () => {
  const users = new Map<string, { employeeId?: unknown }>();
  const employees = new Map<string, { userId: string | null }>();
  const sideRecords = new Map<string, Set<string>>();
  const calls: string[] = [];

  const backend: UserCleanupBackend = {
    readUser: async (uid) => users.get(uid),
    deleteUserDoc: async (uid) => {
      calls.push("deleteUserDoc");
      users.delete(uid);
    },
    deleteByUid: async (collection, uid) => {
      calls.push(`deleteByUid:${collection}`);
      sideRecords.get(collection)?.delete(uid);
    },
    unlinkEmployee: async (employeeId) => {
      calls.push("unlinkEmployee");
      const employee = employees.get(employeeId);
      if (employee) employees.set(employeeId, { ...employee, userId: null });
    },
  };

  return {
    backend,
    users,
    employees,
    sideRecords,
    calls,
    addSideRecord: (collection: string, uid: string) => {
      if (!sideRecords.has(collection)) sideRecords.set(collection, new Set());
      sideRecords.get(collection)!.add(uid);
    },
    hasSideRecord: (collection: string, uid: string) =>
      sideRecords.get(collection)?.has(uid) ?? false,
  };
};

describe("cleanUpDeletedUser", () => {
  let fake: ReturnType<typeof fakeBackend>;

  beforeEach(() => {
    fake = fakeBackend();
  });

  it("deletes the user document, which holds the person's name, email and role", async () => {
    fake.users.set("uid1", {});

    const report = await cleanUpDeletedUser("uid1", fake.backend);

    expect(fake.users.has("uid1")).toBe(false);
    expect(report.userDocDeleted).toBe(true);
  });

  it("clears the claim metadata and any outstanding verification challenge", async () => {
    fake.users.set("uid1", {});
    fake.addSideRecord("userClaims", "uid1");
    fake.addSideRecord("emailVerifications", "uid1");

    const report = await cleanUpDeletedUser("uid1", fake.backend);

    expect(fake.hasSideRecord("userClaims", "uid1")).toBe(false);
    expect(fake.hasSideRecord("emailVerifications", "uid1")).toBe(false);
    expect(report.sideRecordsCleared).toEqual([...UID_KEYED_COLLECTIONS]);
  });

  // An employee record carries salary, employment dates and equipment. Losing
  // a login is not a reason to destroy it — onEmployeeDeleted covers that case.
  it("unlinks the employee record rather than deleting it", async () => {
    fake.users.set("uid1", { employeeId: "emp1" });
    fake.employees.set("emp1", { userId: "uid1" });

    const report = await cleanUpDeletedUser("uid1", fake.backend);

    expect(fake.employees.get("emp1")).toEqual({ userId: null });
    expect(report.employeeUnlinked).toBe("emp1");
  });

  // The employee id only exists on the document about to be deleted.
  it("reads the employee id before deleting the user document", async () => {
    fake.users.set("uid1", { employeeId: "emp1" });
    fake.employees.set("emp1", { userId: "uid1" });

    await cleanUpDeletedUser("uid1", fake.backend);

    expect(fake.calls.indexOf("unlinkEmployee")).toBeLessThan(
      fake.calls.indexOf("deleteUserDoc")
    );
  });

  it("does not try to unlink when the user was never linked", async () => {
    fake.users.set("uid1", {});

    const report = await cleanUpDeletedUser("uid1", fake.backend);

    expect(fake.calls).not.toContain("unlinkEmployee");
    expect(report.employeeUnlinked).toBeNull();
  });

  it.each([
    ["null", null],
    ["an empty string", ""],
    ["a number", 7],
  ])("ignores an employeeId that is %s", async (_label, employeeId) => {
    fake.users.set("uid1", { employeeId });

    const report = await cleanUpDeletedUser("uid1", fake.backend);

    expect(report.employeeUnlinked).toBeNull();
    expect(fake.calls).not.toContain("unlinkEmployee");
  });

  // A signup deleted between requesting a code and the user document landing.
  it("still clears side records when there is no user document", async () => {
    fake.addSideRecord("emailVerifications", "uid1");

    const report = await cleanUpDeletedUser("uid1", fake.backend);

    expect(report.userDocDeleted).toBe(false);
    expect(fake.hasSideRecord("emailVerifications", "uid1")).toBe(false);
    expect(fake.calls).not.toContain("deleteUserDoc");
  });

  it("leaves another user's records alone", async () => {
    fake.users.set("uid1", {});
    fake.users.set("uid2", {});
    fake.addSideRecord("userClaims", "uid2");

    await cleanUpDeletedUser("uid1", fake.backend);

    expect(fake.users.has("uid2")).toBe(true);
    expect(fake.hasSideRecord("userClaims", "uid2")).toBe(true);
  });

  it("is idempotent when the deletion event is redelivered", async () => {
    fake.users.set("uid1", { employeeId: "emp1" });
    fake.employees.set("emp1", { userId: "uid1" });

    await cleanUpDeletedUser("uid1", fake.backend);
    const second = await cleanUpDeletedUser("uid1", fake.backend);

    expect(second.userDocDeleted).toBe(false);
    expect(second.employeeUnlinked).toBeNull();
    expect(fake.employees.get("emp1")).toEqual({ userId: null });
  });
});
