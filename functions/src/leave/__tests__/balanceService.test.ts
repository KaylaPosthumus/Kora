import { describe, it, expect, beforeEach } from "vitest";

import { adjustBalance, type BalanceAdjustmentBackend } from "../balanceService";
import type { AdjustmentRecord, BalanceDoc } from "../balanceAdjustment";

const ADMIN = { uid: "admin-uid", tokenRole: "admin" };
const EMPLOYEE = { uid: "emp-uid", tokenRole: "employee" };

const validInput = {
  employeeId: "emp1",
  leaveTypeId: "annual",
  mode: "delta" as const,
  days: 3,
  reason: "Carried over from 2025",
};

/**
 * A store holding one balance per `employeeId/leaveTypeId`, with the decide and
 * record callbacks wired the way the Admin SDK implementation wires them:
 * the audit entry is written only when the decision is `ok`, in the same step
 * as the balance.
 */
const fakeBackend = (admins: string[] = ["admin-uid"]) => {
  const balances = new Map<string, BalanceDoc>();
  const audit: AdjustmentRecord[] = [];
  let commits = 0;

  const key = (employeeId: string, leaveTypeId: string) => `${employeeId}/${leaveTypeId}`;

  const backend: BalanceAdjustmentBackend = {
    isAdmin: async (uid, tokenRole) => tokenRole === "admin" || admins.includes(uid),

    commit: async (employeeId, leaveTypeId, decide, record) => {
      commits += 1;
      const path = key(employeeId, leaveTypeId);
      const outcome = decide(balances.get(path));

      if (outcome.status === "ok") {
        balances.set(path, { ...balances.get(path)!, remainingDays: outcome.after });
        audit.push(record(outcome));
      }

      return outcome;
    },
  };

  return {
    backend,
    audit,
    commits: () => commits,
    seed: (employeeId: string, leaveTypeId: string, remainingDays: number) =>
      balances.set(key(employeeId, leaveTypeId), {
        leaveTypeId,
        leaveTypeName: "Annual",
        defaultDays: 20,
        remainingDays,
      }),
    read: (employeeId: string, leaveTypeId: string) => balances.get(key(employeeId, leaveTypeId)),
  };
};

describe("adjustBalance — authorisation", () => {
  let fake: ReturnType<typeof fakeBackend>;

  beforeEach(() => {
    fake = fakeBackend();
  });

  it("applies an adjustment for an admin", async () => {
    fake.seed("emp1", "annual", 12);

    const result = await adjustBalance(ADMIN, validInput, fake.backend);

    expect(result).toEqual({ status: "ok", before: 12, after: 15, delta: 3 });
    expect(fake.read("emp1", "annual")!.remainingDays).toBe(15);
  });

  it("refuses a non-admin caller", async () => {
    fake.seed("emp1", "annual", 12);

    const result = await adjustBalance(EMPLOYEE, validInput, fake.backend);

    expect(result).toEqual({ status: "forbidden" });
    expect(fake.read("emp1", "annual")!.remainingDays).toBe(12);
  });

  // A non-admin must not be able to probe for which employees or balances
  // exist by reading the difference between "forbidden" and "no-balance".
  it("checks authorisation before touching any data", async () => {
    await adjustBalance(EMPLOYEE, validInput, fake.backend);

    expect(fake.commits()).toBe(0);
  });

  it("accepts an admin known by user document despite a stale claim", async () => {
    fake.seed("emp1", "annual", 12);

    const result = await adjustBalance(
      { uid: "admin-uid", tokenRole: "employee" },
      validInput,
      fake.backend
    );

    expect(result.status).toBe("ok");
  });
});

describe("adjustBalance — input validation", () => {
  let fake: ReturnType<typeof fakeBackend>;

  beforeEach(() => {
    fake = fakeBackend();
    fake.seed("emp1", "annual", 12);
  });

  it.each([
    ["a missing employeeId", { ...validInput, employeeId: undefined }],
    ["a blank employeeId", { ...validInput, employeeId: "   " }],
    ["a non-string employeeId", { ...validInput, employeeId: 7 }],
    ["a missing leaveTypeId", { ...validInput, leaveTypeId: undefined }],
    ["a blank leaveTypeId", { ...validInput, leaveTypeId: "" }],
    ["a missing mode", { ...validInput, mode: undefined }],
    ["an unknown mode", { ...validInput, mode: "increment" }],
  ])("rejects %s", async (_label, input) => {
    const result = await adjustBalance(ADMIN, input, fake.backend);

    expect(result.status).toBe("invalid-input");
    expect(fake.commits()).toBe(0);
  });

  it("rejects a missing payload entirely", async () => {
    expect((await adjustBalance(ADMIN, undefined, fake.backend)).status).toBe(
      "invalid-input"
    );
  });

  it("trims surrounding whitespace from the ids", async () => {
    const result = await adjustBalance(
      ADMIN,
      { ...validInput, employeeId: "  emp1  ", leaveTypeId: " annual " },
      fake.backend
    );

    expect(result.status).toBe("ok");
    expect(fake.read("emp1", "annual")!.remainingDays).toBe(15);
  });

  // The day and reason rules live in planAdjustment; this only checks they are
  // actually reached rather than re-implemented here.
  it("surfaces a bad day count from the planner", async () => {
    const result = await adjustBalance(ADMIN, { ...validInput, days: 1.5 }, fake.backend);

    expect(result.status).toBe("invalid-days");
  });

  it("surfaces a missing reason from the planner", async () => {
    const result = await adjustBalance(ADMIN, { ...validInput, reason: "" }, fake.backend);

    expect(result.status).toBe("invalid-reason");
  });
});

describe("adjustBalance — the audit trail", () => {
  let fake: ReturnType<typeof fakeBackend>;

  beforeEach(() => {
    fake = fakeBackend();
    fake.seed("emp1", "annual", 12);
  });

  it("records who changed what, and from what to what", async () => {
    await adjustBalance(ADMIN, validInput, fake.backend);

    expect(fake.audit).toEqual([
      {
        employeeId: "emp1",
        leaveTypeId: "annual",
        before: 12,
        after: 15,
        delta: 3,
        reason: "Carried over from 2025",
        adminUid: "admin-uid",
      },
    ]);
  });

  // Attributing the change to the verified token, never to the payload, is what
  // stops an admin logging a correction under someone else's name.
  it("attributes the change to the caller's own uid", async () => {
    await adjustBalance(
      { uid: "admin-two", tokenRole: "admin" },
      { ...validInput, adminUid: "someone-else" },
      fake.backend
    );

    expect(fake.audit[0].adminUid).toBe("admin-two");
  });

  it("writes no audit entry when nothing changed", async () => {
    await adjustBalance(ADMIN, { ...validInput, mode: "set", days: 12 }, fake.backend);

    expect(fake.audit).toEqual([]);
  });

  it("writes no audit entry for a rejected adjustment", async () => {
    await adjustBalance(ADMIN, { ...validInput, days: -99 }, fake.backend);

    expect(fake.audit).toEqual([]);
    expect(fake.read("emp1", "annual")!.remainingDays).toBe(12);
  });
});

describe("adjustBalance — outcomes", () => {
  let fake: ReturnType<typeof fakeBackend>;

  beforeEach(() => {
    fake = fakeBackend();
  });

  it("reports no-balance when the employee has none of that leave type", async () => {
    const result = await adjustBalance(ADMIN, validInput, fake.backend);

    expect(result).toEqual({ status: "no-balance" });
  });

  it("reports unchanged without writing", async () => {
    fake.seed("emp1", "annual", 12);

    const result = await adjustBalance(
      ADMIN,
      { ...validInput, mode: "set", days: 12 },
      fake.backend
    );

    expect(result).toEqual({ status: "unchanged", remainingDays: 12 });
  });

  it("refuses to drive a balance negative by default", async () => {
    fake.seed("emp1", "annual", 2);

    const result = await adjustBalance(ADMIN, { ...validInput, days: -5 }, fake.backend);

    expect(result).toEqual({ status: "would-go-negative", before: 2, after: -3 });
    expect(fake.read("emp1", "annual")!.remainingDays).toBe(2);
  });

  it("allows a negative result when the caller opts in", async () => {
    fake.seed("emp1", "annual", 2);

    const result = await adjustBalance(
      ADMIN,
      { ...validInput, days: -5, allowNegative: true },
      fake.backend
    );

    expect(result.status).toBe("ok");
    expect(fake.read("emp1", "annual")!.remainingDays).toBe(-3);
  });

  // Only a literal `true` opts in — a truthy string from a form must not.
  it("does not treat a truthy non-boolean as opting in", async () => {
    fake.seed("emp1", "annual", 2);

    const result = await adjustBalance(
      ADMIN,
      { ...validInput, days: -5, allowNegative: "yes" },
      fake.backend
    );

    expect(result.status).toBe("would-go-negative");
  });

  it("sets an absolute figure in set mode", async () => {
    fake.seed("emp1", "annual", 12);

    await adjustBalance(ADMIN, { ...validInput, mode: "set", days: 20 }, fake.backend);

    expect(fake.read("emp1", "annual")!.remainingDays).toBe(20);
  });
});
