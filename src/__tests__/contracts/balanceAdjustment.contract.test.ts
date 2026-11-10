/**
 * The leave-balance correction, across the package boundary.
 *
 * `adjustLeaveBalance` decides in `functions/`; `AdjustLeaveBalanceModal` reports
 * the answer in `src/`. The outcome union is declared twice — once per package —
 * so a status added on one side and not the other is invisible to both suites.
 *
 * Here the real backend decision function produces each outcome, and the real
 * frontend describer turns it into a sentence. A new status falls through
 * `describeAdjustResult`'s switch and fails.
 */

import { describe, it, expect } from "vitest";

import {
  planAdjustment,
  MAX_REASON_LENGTH as BACKEND_MAX_REASON,
  type AdjustmentOutcome,
} from "../../../functions/src/leave/balanceAdjustment";

import {
  describeAdjustResult,
  MAX_REASON_LENGTH as FRONTEND_MAX_REASON,
  type AdjustBalanceResult,
} from "@/features/leave/api/leaveBalanceApi";

const balance = { leaveTypeId: "annual", remainingDays: 10, defaultDays: 15 };
const reason = "Pro-rata allowance for a June start";

const describe_ = (outcome: AdjustmentOutcome) =>
  describeAdjustResult(outcome as AdjustBalanceResult);

describe("every outcome the backend plans, the frontend can describe", () => {
  it("an applied correction", () => {
    const outcome = planAdjustment(balance, { mode: "delta", days: 5, reason });
    expect(outcome.status).toBe("ok");
    expect(describe_(outcome)).toBe("Balance updated from 10 to 15 days.");
  });

  it("a correction that changes nothing", () => {
    const outcome = planAdjustment(balance, { mode: "set", days: 10, reason });
    expect(outcome.status).toBe("unchanged");
    expect(describe_(outcome)).toContain("10 days");
  });

  it("a correction that would go negative", () => {
    const outcome = planAdjustment(balance, { mode: "delta", days: -12, reason });
    expect(outcome.status).toBe("would-go-negative");
    expect(describe_(outcome)).toContain("-2");
  });

  it("no balance document at all", () => {
    const outcome = planAdjustment(undefined, { mode: "delta", days: 1, reason });
    expect(outcome.status).toBe("no-balance");
    expect(describe_(outcome)).toBeTruthy();
  });

  it("a day count the backend rejects", () => {
    const outcome = planAdjustment(balance, { mode: "delta", days: 1.5, reason });
    expect(outcome.status).toBe("invalid-days");
    // The backend owns this wording; the frontend must pass it through rather
    // than inventing its own, or the two drift.
    expect(describe_(outcome)).toBe(
      (outcome as { message: string }).message
    );
  });

  it("a missing reason", () => {
    const outcome = planAdjustment(balance, { mode: "delta", days: 1, reason: "" });
    expect(outcome.status).toBe("invalid-reason");
    expect(describe_(outcome)).toBe((outcome as { message: string }).message);
  });

  it("a reason past the limit", () => {
    const outcome = planAdjustment(balance, {
      mode: "delta",
      days: 1,
      reason: "x".repeat(BACKEND_MAX_REASON + 1),
    });
    expect(outcome.status).toBe("invalid-reason");
    expect(describe_(outcome)).toBeTruthy();
  });
});

describe("the two halves agree on the limits", () => {
  it("caps the reason at the same length", () => {
    // The modal counts characters down against this. If the frontend's copy were
    // larger, the form would accept text the backend then refuses.
    expect(FRONTEND_MAX_REASON).toBe(BACKEND_MAX_REASON);
  });

  it("assigns a backend outcome to the frontend result type without a cast", () => {
    const outcome: AdjustmentOutcome = { status: "ok", before: 1, after: 2, delta: 1 };
    const asFrontend: AdjustBalanceResult = outcome;
    expect(asFrontend.status).toBe("ok");
  });
});
