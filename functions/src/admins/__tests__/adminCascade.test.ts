import { describe, it, expect, beforeEach } from "vitest";

import { ADMIN_CASCADE, ADMIN_USER_UNLINK_FIELDS } from "../adminCascade";
import { runSteps, type StepBackend } from "../../shared/cascade";

const fakeBackend = () => {
  const docs = new Map<string, Map<string, Record<string, unknown>>>();
  const calls: string[] = [];

  const collection = (name: string) => {
    if (!docs.has(name)) docs.set(name, new Map());
    return docs.get(name)!;
  };

  const backend: StepBackend = {
    findByField: async (name, field, value) =>
      [...collection(name).entries()]
        .filter(([, data]) => data[field] === value)
        .map(([id]) => id),
    deleteAll: async (name, ids) => {
      calls.push(`deleteAll:${name}`);
      ids.forEach((id) => collection(name).delete(id));
    },
    updateAll: async (name, ids, data) => {
      calls.push(`updateAll:${name}`);
      ids.forEach((id) => collection(name).set(id, { ...collection(name).get(id), ...data }));
    },
  };

  return {
    backend,
    calls,
    seed: (name: string, entries: Record<string, Record<string, unknown>>) =>
      Object.entries(entries).forEach(([id, data]) => collection(name).set(id, data)),
    read: (name: string, id: string) => collection(name).get(id),
    ids: (name: string) => [...collection(name).keys()].sort(),
  };
};

describe("ADMIN_CASCADE policy", () => {
  // The deliberate difference from EMPLOYEE_CASCADE: a performance review is a
  // record about the employee, so losing an admin must not destroy it.
  it("deletes nothing", () => {
    expect(ADMIN_CASCADE.every((step) => step.kind === "clear")).toBe(true);
  });

  it("covers both gathering collections", () => {
    expect(ADMIN_CASCADE.map((step) => step.collection).sort()).toEqual([
      "meetings",
      "performanceReviews",
    ]);
  });

  // adminName is the historical fact of who ran it, and must survive.
  it("clears only adminId, never adminName", () => {
    for (const step of ADMIN_CASCADE) {
      expect(step.kind === "clear" && step.fields).toEqual(["adminId"]);
    }
  });

  it("unlinks the user without touching their employee link", () => {
    expect(ADMIN_USER_UNLINK_FIELDS).toEqual({
      isLinked: false,
      adminId: null,
      role: "unassigned",
    });
    expect(ADMIN_USER_UNLINK_FIELDS).not.toHaveProperty("employeeId");
  });

  // isAdmin() in firestore.rules reads users/{uid}.role as well as the claim,
  // so leaving it as "admin" keeps a deleted admin's org-wide access alive.
  it("strips the admin role rather than only the link", () => {
    expect(ADMIN_USER_UNLINK_FIELDS.role).toBe("unassigned");
  });
});

describe("running the admin cascade", () => {
  let fake: ReturnType<typeof fakeBackend>;

  beforeEach(() => {
    fake = fakeBackend();
  });

  it("keeps a performance review and its rating, clearing only the admin", async () => {
    fake.seed("performanceReviews", {
      pr1: {
        adminId: "adm1",
        adminName: "Dana Admin",
        employeeId: "emp1",
        rating: 4,
        comment: "Strong year",
      },
    });

    const report = await runSteps("adm1", fake.backend, ADMIN_CASCADE);

    expect(fake.read("performanceReviews", "pr1")).toEqual({
      adminId: null,
      adminName: "Dana Admin",
      employeeId: "emp1",
      rating: 4,
      comment: "Strong year",
    });
    expect(report.cleared.performanceReviews).toBe(1);
    expect(report.deleted).toEqual({});
  });

  it("keeps meetings, clearing only the admin", async () => {
    fake.seed("meetings", {
      m1: { adminId: "adm1", adminName: "Dana Admin", purpose: "1:1" },
    });

    await runSteps("adm1", fake.backend, ADMIN_CASCADE);

    expect(fake.read("meetings", "m1")).toEqual({
      adminId: null,
      adminName: "Dana Admin",
      purpose: "1:1",
    });
    expect(fake.ids("meetings")).toEqual(["m1"]);
  });

  it("leaves another admin's gatherings alone", async () => {
    fake.seed("meetings", {
      m1: { adminId: "adm1" },
      m2: { adminId: "adm2", adminName: "Other" },
    });

    await runSteps("adm1", fake.backend, ADMIN_CASCADE);

    expect(fake.read("meetings", "m2")).toEqual({ adminId: "adm2", adminName: "Other" });
  });

  it("does nothing for an admin with no gatherings", async () => {
    const report = await runSteps("adm1", fake.backend, ADMIN_CASCADE);

    expect(fake.calls).toEqual([]);
    expect(report).toEqual({ deleted: {}, cleared: {} });
  });

  it("is idempotent across a redelivered event", async () => {
    fake.seed("meetings", { m1: { adminId: "adm1", adminName: "Dana" } });

    await runSteps("adm1", fake.backend, ADMIN_CASCADE);
    const second = await runSteps("adm1", fake.backend, ADMIN_CASCADE);

    expect(second).toEqual({ deleted: {}, cleared: {} });
    expect(fake.read("meetings", "m1")).toEqual({ adminId: null, adminName: "Dana" });
  });
});
