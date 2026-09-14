/**
 * The admin-facing leave balance correction, minus the Firestore mechanics.
 *
 * Why this is a function rather than a direct client write: `firestore.rules`
 * already lets an admin write `leaveBalances`, so the *permission* exists. What
 * a rule cannot do is require a reason, record who made the change, and move the
 * balance and its audit entry atomically. A balance is entitlement — and
 * therefore money — so an untraceable edit is the thing to avoid.
 */

import {
  adjustmentRecord,
  planAdjustment,
  type AdjustmentOutcome,
  type AdjustmentRecord,
  type AdjustmentRequest,
  type BalanceDoc,
} from "./balanceAdjustment";

/** The `ok` branch, named for the places that only accept it. */
export type AppliedAdjustment = Extract<AdjustmentOutcome, { status: "ok" }>;

export interface BalanceAdjustmentBackend {
  /** Whether the caller may correct balances. Mirrors `isAdmin()` in the rules. */
  isAdmin(uid: string, tokenRole: unknown): Promise<boolean>;

  /**
   * Atomically: read the balance, run `decide` against it and — only when that
   * returns `ok` — write the new `remainingDays` together with the audit entry
   * from `record`.
   *
   * The read and the write must share a transaction: an approval landing
   * between them would otherwise be silently overwritten, which is precisely
   * the bug `setLeaveRequestStatus` uses `runTransaction` to avoid.
   */
  commit(
    employeeId: string,
    leaveTypeId: string,
    decide: (balance: BalanceDoc | undefined) => AdjustmentOutcome,
    record: (outcome: AppliedAdjustment) => AdjustmentRecord
  ): Promise<AdjustmentOutcome>;
}

export type AdjustResult =
  | { status: "forbidden" }
  | { status: "invalid-input"; message: string }
  | AdjustmentOutcome;

const nonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

/** The payload shape a caller sends. Everything arrives untrusted. */
interface RawInput {
  employeeId?: unknown;
  leaveTypeId?: unknown;
  mode?: unknown;
  days?: unknown;
  reason?: unknown;
  allowNegative?: unknown;
}

/**
 * Applies an admin's correction to one leave balance.
 *
 * Authorisation is checked before anything is read, so a non-admin learns
 * nothing about whether an employee or balance exists.
 */
export const adjustBalance = async (
  caller: { uid: string; tokenRole: unknown },
  input: RawInput | undefined,
  backend: BalanceAdjustmentBackend
): Promise<AdjustResult> => {
  if (!(await backend.isAdmin(caller.uid, caller.tokenRole))) {
    return { status: "forbidden" };
  }

  const { employeeId, leaveTypeId, mode, days, reason, allowNegative } = input ?? {};

  if (!nonEmptyString(employeeId)) {
    return { status: "invalid-input", message: "employeeId is required." };
  }
  if (!nonEmptyString(leaveTypeId)) {
    return { status: "invalid-input", message: "leaveTypeId is required." };
  }
  if (mode !== "set" && mode !== "delta") {
    return { status: "invalid-input", message: 'mode must be "set" or "delta".' };
  }

  const request: AdjustmentRequest = {
    mode,
    // Left unvalidated here on purpose: planAdjustment owns what a legal day
    // count is, and duplicating that check would let the two drift apart.
    days: days as number,
    reason: reason as string,
    allowNegative: allowNegative === true,
  };

  return backend.commit(
    employeeId.trim(),
    leaveTypeId.trim(),
    (balance) => planAdjustment(balance, request),
    (outcome) =>
      adjustmentRecord(
        employeeId.trim(),
        leaveTypeId.trim(),
        caller.uid,
        request.reason,
        outcome
      )
  );
};
