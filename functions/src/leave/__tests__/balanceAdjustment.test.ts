import { describe, it, expect } from "vitest";

import {
  MAX_REASON_LENGTH,
  adjustmentRecord,
  planAdjustment,
  type AdjustmentOutcome,
  type BalanceDoc,
} from "../balanceAdjustment";

const balance = (remainingDays: number): BalanceDoc => ({
  leaveTypeId: "annual",
  leaveTypeName: "Annual",
  defaultDays: 20,
  remainingDays,
});

const reason = "Carried over from 2025";

describe("planAdjustment — set mode", () => {
  it("writes an absolute figure", () => {
    expect(planAdjustment(balance(12), { mode: "set", days: 20, reason })).toEqual({
      status: "ok",
      before: 12,
      after: 20,
      delta: 8,
    });
  });

  it("reports a negative delta when setting lower", () => {
    expect(planAdjustment(balance(20), { mode: "set", days: 5, reason })).toEqual({
      status: "ok",
      before: 20,
      after: 5,
      delta: -15,
    });
  });

  it("allows setting a balance to exactly zero", () => {
    expect(planAdjustment(balance(3), { mode: "set", days: 0, reason })).toEqual({
      status: "ok",
      before: 3,
      after: 0,
      delta: -3,
    });
  });
});

describe("planAdjustment — delta mode", () => {
  it("adds to the current balance", () => {
    expect(planAdjustment(balance(12), { mode: "delta", days: 3, reason })).toEqual({
      status: "ok",
      before: 12,
      after: 15,
      delta: 3,
    });
  });

  it("subtracts from the current balance", () => {
    expect(planAdjustment(balance(12), { mode: "delta", days: -2, reason })).toEqual({
      status: "ok",
      before: 12,
      after: 10,
      delta: -2,
    });
  });
});

describe("planAdjustment — no-op", () => {
  it("reports unchanged when setting the value it already has", () => {
    expect(planAdjustment(balance(12), { mode: "set", days: 12, reason })).toEqual({
      status: "unchanged",
      remainingDays: 12,
    });
  });

  it("reports unchanged for a zero delta", () => {
    expect(planAdjustment(balance(12), { mode: "delta", days: 0, reason })).toEqual({
      status: "unchanged",
      remainingDays: 12,
    });
  });
});

describe("planAdjustment — guarding the negative case", () => {
  // A manual correction landing negative is almost always a typo. The
  // over-approval path in setLeaveRequestStatus is deliberate and separate.
  it("refuses to go negative by default", () => {
    expect(planAdjustment(balance(2), { mode: "delta", days: -5, reason })).toEqual({
      status: "would-go-negative",
      before: 2,
      after: -3,
    });
  });

  it("refuses a negative absolute value by default", () => {
    expect(planAdjustment(balance(2), { mode: "set", days: -1, reason })).toEqual({
      status: "would-go-negative",
      before: 2,
      after: -1,
    });
  });

  it("permits going negative when explicitly allowed", () => {
    expect(
      planAdjustment(balance(2), { mode: "delta", days: -5, reason, allowNegative: true })
    ).toEqual({ status: "ok", before: 2, after: -3, delta: -5 });
  });

  // An over-approved balance is already negative; an admin must still be able
  // to correct it upward without setting a flag.
  it("allows correcting an already-negative balance upward", () => {
    expect(planAdjustment(balance(-3), { mode: "delta", days: 5, reason })).toEqual({
      status: "ok",
      before: -3,
      after: 2,
      delta: 5,
    });
  });
});

describe("planAdjustment — validation", () => {
  it("reports no-balance when the document is missing", () => {
    expect(planAdjustment(undefined, { mode: "set", days: 5, reason })).toEqual({
      status: "no-balance",
    });
  });

  it.each([
    ["a fraction", 1.5],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["a numeric string", "5"],
    ["null", null],
    ["undefined", undefined],
  ])("rejects %s as a day count", (_label, days) => {
    const outcome = planAdjustment(balance(10), {
      mode: "set",
      days: days as number,
      reason,
    });
    expect(outcome.status).toBe("invalid-days");
  });

  // The audit record is the whole point of routing this through a function.
  it.each([
    ["an empty reason", ""],
    ["whitespace only", "   "],
    ["a non-string reason", 42],
  ])("rejects %s", (_label, value) => {
    const outcome = planAdjustment(balance(10), {
      mode: "set",
      days: 5,
      reason: value as string,
    });
    expect(outcome.status).toBe("invalid-reason");
  });

  it("rejects a reason longer than the limit", () => {
    const outcome = planAdjustment(balance(10), {
      mode: "set",
      days: 5,
      reason: "x".repeat(MAX_REASON_LENGTH + 1),
    });
    expect(outcome.status).toBe("invalid-reason");
  });

  it("accepts a reason exactly at the limit", () => {
    const outcome = planAdjustment(balance(10), {
      mode: "set",
      days: 5,
      reason: "x".repeat(MAX_REASON_LENGTH),
    });
    expect(outcome.status).toBe("ok");
  });

  // A balance corrupted to a non-integer should be reported, not silently
  // propagated into arithmetic that produces another bad figure.
  it("refuses to work from a corrupted stored balance", () => {
    const corrupted = { ...balance(0), remainingDays: 1.5 };
    expect(planAdjustment(corrupted, { mode: "delta", days: 1, reason }).status).toBe(
      "invalid-days"
    );
  });
});

describe("adjustmentRecord", () => {
  const ok = (): Extract<AdjustmentOutcome, { status: "ok" }> => ({
    status: "ok",
    before: 12,
    after: 15,
    delta: 3,
  });

  it("captures who changed what, and from what to what", () => {
    expect(adjustmentRecord("emp1", "annual", "admin-uid", reason, ok())).toEqual({
      employeeId: "emp1",
      leaveTypeId: "annual",
      before: 12,
      after: 15,
      delta: 3,
      reason,
      adminUid: "admin-uid",
    });
  });

  it("trims the stored reason", () => {
    const record = adjustmentRecord("emp1", "annual", "admin-uid", "  spaced  ", ok());
    expect(record.reason).toBe("spaced");
  });
});
