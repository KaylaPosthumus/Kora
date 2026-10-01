/**
 * The admin correction path for a leave balance.
 *
 * Balances otherwise move only as a side effect of approving or un-approving a
 * request, so a balance that is wrong for any other reason — a mid-year joiner's
 * pro-rata allowance, days carried over, a request approved against the wrong
 * leave type — could not be fixed at all. CoriCore had CRUD here; this is its
 * replacement.
 *
 * It goes through a callable rather than a direct write even though
 * `firestore.rules` already lets an admin write `leaveBalances`. The permission
 * exists; what a rule cannot do is require a reason, record who made the change,
 * and move the balance and its audit entry atomically. A balance is entitlement,
 * so an untraceable edit is the thing to avoid.
 */

import { callable } from "@/shared/lib/callable";
import type { ApiResponse } from "@/shared/lib/firestore";

export interface AdjustBalanceInput {
  employeeId: string;
  leaveTypeId: string;
  /** `set` writes an absolute figure; `delta` adds to what is there. */
  mode: "set" | "delta";
  /** Whole days. For `delta`, negative removes. */
  days: number;
  /** Required, and stored on the audit entry. */
  reason: string;
  /** Let the result fall below zero. The admin confirms this explicitly. */
  allowNegative?: boolean;
}

/**
 * Every answer the function can give.
 *
 * All of these are *results*, not transport failures — they arrive with HTTP 200
 * and the screen decides what to say. Only a genuine failure rejects, as a
 * `CallableError`.
 */
export type AdjustBalanceResult =
  | { status: "ok"; before: number; after: number; delta: number }
  | { status: "unchanged"; remainingDays: number }
  | { status: "would-go-negative"; before: number; after: number }
  | { status: "no-balance" }
  | { status: "invalid-days"; message: string }
  | { status: "invalid-reason"; message: string }
  | { status: "invalid-input"; message: string }
  | { status: "forbidden" };

/** The longest reason the backend accepts; mirrored so the form can count down. */
export const MAX_REASON_LENGTH = 500;

const call = callable<AdjustBalanceInput, AdjustBalanceResult>("adjustLeaveBalance");

export const leaveBalanceAPI = {
  /**
   * Corrects one employee's balance for one leave type.
   *
   * `would-go-negative` is the branch worth handling rather than treating as an
   * error: it means the correction is legal but takes the employee below zero,
   * and the caller may re-send with `allowNegative: true`. That mirrors how
   * approving over-balance leave already works.
   */
  adjust: (input: AdjustBalanceInput): Promise<ApiResponse<AdjustBalanceResult>> =>
    call(input),
};

/** A sentence for each non-`ok` outcome, so screens do not each invent their own. */
export const describeAdjustResult = (result: AdjustBalanceResult): string => {
  switch (result.status) {
    case "ok":
      return `Balance updated from ${result.before} to ${result.after} days.`;
    case "unchanged":
      return `That is already the balance (${result.remainingDays} days). Nothing changed.`;
    case "would-go-negative":
      return `That would take the balance to ${result.after} days.`;
    case "no-balance":
      return "This employee has no balance for that leave type yet.";
    case "forbidden":
      return "Only an admin can correct a leave balance.";
    default:
      return result.message;
  }
};
