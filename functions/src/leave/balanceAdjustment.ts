/**
 * Correcting an employee's leave balance by hand.
 *
 * CoriCore had a LeaveBalance CRUD API. Nothing in the Electron frontend ever
 * called it — balances only ever arrived through the page endpoints — so the
 * shape here is reconstructed from intent rather than from a call site.
 *
 * Today `setLeaveRequestStatus` is the *only* thing that moves a balance, and it
 * moves it as a side effect of a status transition. There is no path for an
 * admin to fix a balance that is wrong: an employee who joined mid-year with a
 * pro-rata allowance, days carried over from last year, or a correction after a
 * request was approved against the wrong leave type.
 *
 * Balances are whole days. The ER diagram types `LeaveBalance.RemainingDays` as
 * `INT`, and `setupUserAsEmployee` seeds them from an integer `defaultDays`.
 */

/** A `employees/{id}/leaveBalances/{leaveTypeId}` document. */
export interface BalanceDoc {
  leaveTypeId: string;
  leaveTypeName?: string;
  description?: string;
  defaultDays: number;
  remainingDays: number;
}

/** How the caller wants the balance moved. */
export interface AdjustmentRequest {
  /** `set` writes an absolute figure; `delta` adds to what is there. */
  mode: "set" | "delta";
  days: number;
  /** Why. Required — see {@link MAX_REASON_LENGTH}. */
  reason: string;
  /**
   * Permits a result below zero. Off by default: a manual correction landing
   * negative is nearly always a typo, whereas the over-approval that
   * `setLeaveRequestStatus` allows is a deliberate flow with its own
   * confirmation modal in front of it.
   */
  allowNegative?: boolean;
}

export const MAX_REASON_LENGTH = 500;

export type AdjustmentOutcome =
  | { status: "ok"; before: number; after: number; delta: number }
  | { status: "no-balance" }
  | { status: "invalid-days"; message: string }
  | { status: "invalid-reason"; message: string }
  | { status: "would-go-negative"; before: number; after: number }
  /** The figure is already what was asked for; nothing is written. */
  | { status: "unchanged"; remainingDays: number };

const isWholeNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value);

/**
 * Validates a request and works out the resulting balance.
 *
 * Pure: it decides, and the caller writes. Every rejection is a returned status
 * rather than a throw, so the callable can hand the UI something to branch on.
 */
export const planAdjustment = (
  balance: BalanceDoc | undefined,
  request: AdjustmentRequest
): AdjustmentOutcome => {
  if (balance === undefined) return { status: "no-balance" };

  if (!isWholeNumber(request.days)) {
    return {
      status: "invalid-days",
      message: "Leave is tracked in whole days, so days must be an integer.",
    };
  }

  // A reason is mandatory: this edits a figure with a direct money and
  // entitlement implication, and the audit record is worthless without one.
  const reason = typeof request.reason === "string" ? request.reason.trim() : "";
  if (reason.length === 0) {
    return { status: "invalid-reason", message: "A reason is required." };
  }
  if (reason.length > MAX_REASON_LENGTH) {
    return {
      status: "invalid-reason",
      message: `A reason must be ${MAX_REASON_LENGTH} characters or fewer.`,
    };
  }

  const before = balance.remainingDays;
  if (!isWholeNumber(before)) {
    return {
      status: "invalid-days",
      message: "The stored balance is not a whole number of days.",
    };
  }

  const after = request.mode === "set" ? request.days : before + request.days;

  if (after < 0 && request.allowNegative !== true) {
    return { status: "would-go-negative", before, after };
  }

  if (after === before) return { status: "unchanged", remainingDays: before };

  return { status: "ok", before, after, delta: after - before };
};

/** The audit record written alongside every applied adjustment. */
export interface AdjustmentRecord {
  employeeId: string;
  leaveTypeId: string;
  before: number;
  after: number;
  delta: number;
  reason: string;
  /** The admin who made the change, from the verified ID token. */
  adminUid: string;
}

/**
 * Builds the audit record for an applied adjustment.
 *
 * Separate from {@link planAdjustment} so the timestamp — the one impure part —
 * stays with the caller that writes it.
 */
export const adjustmentRecord = (
  employeeId: string,
  leaveTypeId: string,
  adminUid: string,
  reason: string,
  outcome: Extract<AdjustmentOutcome, { status: "ok" }>
): AdjustmentRecord => ({
  employeeId,
  leaveTypeId,
  before: outcome.before,
  after: outcome.after,
  delta: outcome.delta,
  reason: reason.trim(),
  adminUid,
});
