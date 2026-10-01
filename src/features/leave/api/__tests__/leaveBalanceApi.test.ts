/**
 * The admin balance correction, from the client side.
 *
 * The backend owns the rules — what a legal day count is, whether a reason is
 * long enough, whether the result goes negative. What is pinned here is that the
 * client sends what the backend expects and reports back what it answered, since
 * a mismatch in either direction shows up as a silent no-op rather than an error.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const callFn = vi.fn();
vi.mock("firebase/functions", () => ({
  httpsCallable: () => callFn,
  getFunctions: () => ({ __fake: "functions" }),
}));
vi.mock("@/services/firebase", async () => (await import("@/test/firebaseApp")).firebaseAppModule());

beforeEach(() => {
  vi.resetModules();
  callFn.mockReset();
});

const load = async () => await import("@/features/leave/api/leaveBalanceApi");

describe("sending a correction", () => {
  it("sends every field the callable validates on", async () => {
    callFn.mockResolvedValue({ data: { status: "ok", before: 10, after: 8, delta: -2 } });
    const { leaveBalanceAPI } = await load();

    await leaveBalanceAPI.adjust({
      employeeId: "emp-1",
      leaveTypeId: "annual",
      mode: "delta",
      days: -2,
      reason: "Approved against the wrong leave type in March",
    });

    expect(callFn).toHaveBeenCalledWith({
      employeeId: "emp-1",
      leaveTypeId: "annual",
      mode: "delta",
      days: -2,
      reason: "Approved against the wrong leave type in March",
      allowNegative: undefined,
    });
  });

  it("carries allowNegative when the admin has confirmed", async () => {
    callFn.mockResolvedValue({ data: { status: "ok", before: 1, after: -1, delta: -2 } });
    const { leaveBalanceAPI } = await load();

    await leaveBalanceAPI.adjust({
      employeeId: "emp-1",
      leaveTypeId: "annual",
      mode: "delta",
      days: -2,
      reason: "Days owed, agreed with payroll",
      allowNegative: true,
    });

    expect(callFn.mock.calls[0][0].allowNegative).toBe(true);
  });

  it("returns the verdict rather than throwing on a refusal", async () => {
    callFn.mockResolvedValue({ data: { status: "would-go-negative", before: 1, after: -1 } });
    const { leaveBalanceAPI } = await load();

    const { data, status } = await leaveBalanceAPI.adjust({
      employeeId: "emp-1",
      leaveTypeId: "annual",
      mode: "delta",
      days: -2,
      reason: "Days owed",
    });

    expect(status).toBe(200);
    expect(data).toEqual({ status: "would-go-negative", before: 1, after: -1 });
  });
});

describe("describing an outcome", () => {
  it("names both ends of a successful correction", async () => {
    const { describeAdjustResult } = await load();
    expect(describeAdjustResult({ status: "ok", before: 10, after: 8, delta: -2 })).toBe(
      "Balance updated from 10 to 8 days."
    );
  });

  it("says nothing changed when the figure already matched", async () => {
    const { describeAdjustResult } = await load();
    expect(describeAdjustResult({ status: "unchanged", remainingDays: 12 })).toContain(
      "already the balance (12 days)"
    );
  });

  it("reports where a negative correction would land", async () => {
    const { describeAdjustResult } = await load();
    expect(
      describeAdjustResult({ status: "would-go-negative", before: 1, after: -3 })
    ).toContain("-3 days");
  });

  it("passes the backend's own message through for the invalid cases", async () => {
    // These carry wording the backend owns — duplicating it here would let the
    // two drift apart.
    const { describeAdjustResult } = await load();
    expect(
      describeAdjustResult({ status: "invalid-reason", message: "A reason is required." })
    ).toBe("A reason is required.");
    expect(
      describeAdjustResult({ status: "invalid-days", message: "Whole days only." })
    ).toBe("Whole days only.");
  });

  it("explains no-balance and forbidden in the admin's terms", async () => {
    const { describeAdjustResult } = await load();
    expect(describeAdjustResult({ status: "no-balance" })).toContain("no balance for that leave type");
    expect(describeAdjustResult({ status: "forbidden" })).toContain("Only an admin");
  });
});

describe("the reason limit", () => {
  it("matches what the backend enforces", async () => {
    // functions/src/leave/balanceAdjustment.ts: MAX_REASON_LENGTH = 500.
    const { MAX_REASON_LENGTH } = await load();
    expect(MAX_REASON_LENGTH).toBe(500);
  });
});
