import { describe, it, expect, beforeEach } from "vitest";

import {
  EMPLOYEE_CASCADE,
  USER_UNLINK_FIELDS,
  runCascade,
  type CascadeBackend,
  type CascadeStep,
} from "../employeeCascade";
import { MAX_BATCH_OPERATIONS } from "../../shared/chunk";

/**
 * An in-memory stand-in for the dependent collections, plus a call log so a
 * test can assert on batching as well as on the end state.
 */
const fakeBackend = () => {
  /** collection -> id -> data */
  const docs = new Map<string, Map<string, Record<string, unknown>>>();
  /** `employees/{id}/{sub}` -> ids */
  const subcollections = new Map<string, string[]>();
  const calls: Array<{ op: string; collection: string; count: number }> = [];

  const collection = (name: string) => {
    if (!docs.has(name)) docs.set(name, new Map());
    return docs.get(name)!;
  };

  const backend: CascadeBackend = {
    findByField: async (name, field, value) =>
      [...collection(name).entries()]
        .filter(([, data]) => data[field] === value)
        .map(([id]) => id),

    listSubcollection: async (employeeId, sub) =>
      subcollections.get(`employees/${employeeId}/${sub}`) ?? [],

    deleteAll: async (name, ids) => {
      calls.push({ op: "deleteAll", collection: name, count: ids.length });
      ids.forEach((id) => collection(name).delete(id));
    },

    deleteSubcollectionDocs: async (employeeId, sub, ids) => {
      const key = `employees/${employeeId}/${sub}`;
      calls.push({ op: "deleteSubcollectionDocs", collection: key, count: ids.length });
      subcollections.set(
        key,
        (subcollections.get(key) ?? []).filter((id) => !ids.includes(id))
      );
    },

    updateAll: async (name, ids, data) => {
      calls.push({ op: "updateAll", collection: name, count: ids.length });
      ids.forEach((id) =>
        collection(name).set(id, { ...collection(name).get(id), ...data })
      );
    },
  };

  return {
    backend,
    calls,
    seed: (name: string, entries: Record<string, Record<string, unknown>>) => {
      Object.entries(entries).forEach(([id, data]) => collection(name).set(id, data));
    },
    seedSubcollection: (employeeId: string, sub: string, ids: string[]) =>
      subcollections.set(`employees/${employeeId}/${sub}`, ids),
    read: (name: string, id: string) => collection(name).get(id),
    ids: (name: string) => [...collection(name).keys()].sort(),
    subIds: (employeeId: string, sub: string) =>
      subcollections.get(`employees/${employeeId}/${sub}`) ?? [],
  };
};

describe("EMPLOYEE_CASCADE policy", () => {
  it("removes the three collections whose documents are meaningless without the employee", () => {
    const deleted = EMPLOYEE_CASCADE.filter((step) => step.kind === "delete").map(
      (step) => step.collection
    );
    expect(deleted.sort()).toEqual(["leaveRequests", "meetings", "performanceReviews"]);
  });

  // Equipment is company property. Deleting it with the employee would destroy
  // the asset register, which is the opposite of what terminateEmpById does.
  it("returns equipment to the pool rather than deleting it", () => {
    const equipment = EMPLOYEE_CASCADE.find((step) => step.collection === "equipment");
    expect(equipment).toMatchObject({
      kind: "clear",
      fields: ["employeeId", "assignedDate"],
    });
  });

  it("keys every step on employeeId", () => {
    expect(EMPLOYEE_CASCADE.every((step) => step.field === "employeeId")).toBe(true);
  });

  // Kept in step with ADMIN_USER_UNLINK_FIELDS: both cascades demote the user
  // rather than leaving a role behind that firestore.rules still reads.
  it("demotes the user's role along with the link", () => {
    expect(USER_UNLINK_FIELDS).toEqual({
      isLinked: false,
      employeeId: null,
      role: "unassigned",
    });
    expect(USER_UNLINK_FIELDS).not.toHaveProperty("adminId");
  });
});

describe("runCascade", () => {
  let fake: ReturnType<typeof fakeBackend>;

  beforeEach(() => {
    fake = fakeBackend();
  });

  it("deletes only the departed employee's dependents", async () => {
    fake.seed("leaveRequests", {
      lr1: { employeeId: "emp1" },
      lr2: { employeeId: "emp2" },
      lr3: { employeeId: "emp1" },
    });

    const report = await runCascade("emp1", fake.backend);

    expect(fake.ids("leaveRequests")).toEqual(["lr2"]);
    expect(report.deleted.leaveRequests).toBe(2);
  });

  it("clears the assignment fields on equipment without deleting it", async () => {
    fake.seed("equipment", {
      eq1: { employeeId: "emp1", assignedDate: "2026-01-01", equipmentName: "Laptop" },
    });

    const report = await runCascade("emp1", fake.backend);

    expect(fake.read("equipment", "eq1")).toEqual({
      employeeId: null,
      assignedDate: null,
      equipmentName: "Laptop",
    });
    expect(report.cleared.equipment).toBe(1);
  });

  // Deleting a Firestore document does not delete its subcollections, and the
  // admin dashboard reads every leaveBalance through a collection-group query.
  it("removes the leaveBalances subcollection a document delete would strand", async () => {
    fake.seedSubcollection("emp1", "leaveBalances", ["annual", "sick"]);

    const report = await runCascade("emp1", fake.backend);

    expect(fake.subIds("emp1", "leaveBalances")).toEqual([]);
    expect(report.subcollections.leaveBalances).toBe(2);
  });

  it("leaves another employee's leave balances alone", async () => {
    fake.seedSubcollection("emp1", "leaveBalances", ["annual"]);
    fake.seedSubcollection("emp2", "leaveBalances", ["annual", "sick"]);

    await runCascade("emp1", fake.backend);

    expect(fake.subIds("emp2", "leaveBalances")).toEqual(["annual", "sick"]);
  });

  it("cascades meetings and performance reviews as well as leave requests", async () => {
    fake.seed("meetings", { m1: { employeeId: "emp1" } });
    fake.seed("performanceReviews", { pr1: { employeeId: "emp1" } });
    fake.seed("leaveRequests", { lr1: { employeeId: "emp1" } });

    const report = await runCascade("emp1", fake.backend);

    expect(report.deleted).toEqual({
      leaveRequests: 1,
      meetings: 1,
      performanceReviews: 1,
    });
  });

  // The reason this runs server-side at all: a browser WriteBatch caps at 500.
  it("splits a cascade larger than one write batch", async () => {
    const requests = Object.fromEntries(
      Array.from({ length: 1200 }, (_, index) => [`lr${index}`, { employeeId: "emp1" }])
    );
    fake.seed("leaveRequests", requests);

    const report = await runCascade("emp1", fake.backend);

    const deletes = fake.calls.filter((call) => call.collection === "leaveRequests");
    expect(deletes.map((call) => call.count)).toEqual([
      MAX_BATCH_OPERATIONS,
      MAX_BATCH_OPERATIONS,
      200,
    ]);
    expect(fake.ids("leaveRequests")).toEqual([]);
    expect(report.deleted.leaveRequests).toBe(1200);
  });

  it("chunks subcollection deletes too", async () => {
    fake.seedSubcollection(
      "emp1",
      "leaveBalances",
      Array.from({ length: 501 }, (_, index) => `lb${index}`)
    );

    await runCascade("emp1", fake.backend);

    const calls = fake.calls.filter((call) => call.op === "deleteSubcollectionDocs");
    expect(calls.map((call) => call.count)).toEqual([MAX_BATCH_OPERATIONS, 1]);
  });

  it("issues no writes for an employee with no dependents", async () => {
    const report = await runCascade("emp1", fake.backend);

    expect(fake.calls).toEqual([]);
    expect(report).toEqual({ deleted: {}, cleared: {}, subcollections: {} });
  });

  // Cloud Functions delivers at least once, and terminateEmpById has usually
  // already done part of this. A second run must be a no-op, not a failure.
  it("is idempotent when run twice", async () => {
    fake.seed("leaveRequests", { lr1: { employeeId: "emp1" } });
    fake.seedSubcollection("emp1", "leaveBalances", ["annual"]);

    const first = await runCascade("emp1", fake.backend);
    const callsAfterFirst = fake.calls.length;
    const second = await runCascade("emp1", fake.backend);

    expect(first.deleted.leaveRequests).toBe(1);
    expect(second).toEqual({ deleted: {}, cleared: {}, subcollections: {} });
    expect(fake.calls).toHaveLength(callsAfterFirst);
  });

  it("runs custom steps when given them", async () => {
    fake.seed("widgets", { w1: { ownerId: "emp1" }, w2: { ownerId: "emp2" } });
    const steps: CascadeStep[] = [
      { kind: "delete", collection: "widgets", field: "ownerId" },
    ];

    const report = await runCascade("emp1", fake.backend, steps, []);

    expect(fake.ids("widgets")).toEqual(["w2"]);
    expect(report.deleted).toEqual({ widgets: 1 });
  });

  // A partial failure should still say how far it got, so the log names the
  // step to resume from rather than just failing opaquely.
  it("propagates a backend failure rather than reporting success", async () => {
    fake.seed("leaveRequests", { lr1: { employeeId: "emp1" } });
    const failing: CascadeBackend = {
      ...fake.backend,
      deleteAll: async () => {
        throw new Error("permission denied");
      },
    };

    await expect(runCascade("emp1", failing)).rejects.toThrow("permission denied");
  });
});
