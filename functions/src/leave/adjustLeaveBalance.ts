/**
 * `adjustLeaveBalance` — the admin correction path CoriCore's LeaveBalance CRUD
 * API provided and this app has been missing.
 *
 * Balances only ever moved as a side effect of `setLeaveRequestStatus`, so a
 * balance that was wrong for any other reason — a mid-year joiner's pro-rata
 * allowance, days carried over, a request approved against the wrong leave type
 * — could not be fixed at all.
 *
 * See `balanceService.ts` for why this is a callable rather than a direct client
 * write, given the rules already permit an admin to write balances.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { FieldValue } from "firebase-admin/firestore";

import { adjustBalance, type BalanceAdjustmentBackend } from "./balanceService";
import type { BalanceDoc } from "./balanceAdjustment";
import { isCallerAdmin } from "../shared/callerRole";
import { db } from "../shared/admin";

/** The audit trail. Admin-readable, never client-writable — see `firestore.rules`. */
export const ADJUSTMENTS_COLLECTION = "leaveBalanceAdjustments";

/** {@link BalanceAdjustmentBackend} backed by the Admin SDK. */
export const adminBalanceBackend = (): BalanceAdjustmentBackend => ({
  isAdmin: async (uid, tokenRole) =>
    isCallerAdmin(tokenRole, async () => {
      const snapshot = await db().collection("users").doc(uid).get();
      return snapshot.exists ? snapshot.data()?.role : undefined;
    }),

  commit: async (employeeId, leaveTypeId, decide, record) => {
    const balanceRef = db()
      .collection("employees")
      .doc(employeeId)
      .collection("leaveBalances")
      .doc(leaveTypeId);

    // Allocated outside the transaction so the id is stable across retries —
    // a contended transaction runs its callback more than once.
    const auditRef = db().collection(ADJUSTMENTS_COLLECTION).doc();

    return db().runTransaction(async (transaction) => {
      const snapshot = await transaction.get(balanceRef);
      const balance = snapshot.exists ? (snapshot.data() as BalanceDoc) : undefined;

      const outcome = decide(balance);

      if (outcome.status === "ok") {
        transaction.update(balanceRef, { remainingDays: outcome.after });
        transaction.set(auditRef, {
          ...record(outcome),
          at: FieldValue.serverTimestamp(),
        });
      }

      return outcome;
    });
  },
});

export const adjustLeaveBalance = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in before adjusting a leave balance.");
  }

  const result = await adjustBalance(
    { uid, tokenRole: request.auth?.token?.role },
    request.data as Record<string, unknown> | undefined,
    adminBalanceBackend()
  );

  // A refused call is worth a louder log than a successful one: it is either a
  // bug in the caller or someone probing an admin-only endpoint.
  if (result.status === "forbidden") {
    logger.warn("adjustLeaveBalance: refused a non-admin caller", { uid });
  } else {
    logger.info("adjustLeaveBalance", { uid, status: result.status });
  }

  return result;
});
