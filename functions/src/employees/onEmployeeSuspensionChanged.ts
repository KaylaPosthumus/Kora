/**
 * `onEmployeeSuspensionChanged` — puts `isSuspended` onto the employee's token.
 *
 * See `claims/suspensionClaim.ts` for why this exists and what suspension is
 * taken to mean. In short: the flag was display-only, and this is the piece that
 * makes `firestore.rules` able to act on it without a document read.
 *
 * Like `syncRoleClaim`, this also stamps `userClaims/{uid}.refreshTime` so the
 * client picks the change up promptly rather than waiting out its token — an
 * employee suspended mid-session should not keep writing for the next hour.
 */

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { FieldValue } from "firebase-admin/firestore";

import {
  isSuspended,
  nextSuspensionClaims,
  suspendedUserId,
  suspensionChanged,
  type SuspendableEmployee,
} from "../claims/suspensionClaim";
import { CLAIMS_METADATA_COLLECTION } from "../claims/syncRoleClaim";
import { auth, db } from "../shared/admin";

export const onEmployeeSuspensionChanged = onDocumentWritten(
  "employees/{employeeId}",
  async (event) => {
    const employeeId = event.params.employeeId;

    const before = event.data?.before.exists
      ? (event.data.before.data() as SuspendableEmployee)
      : undefined;
    const after = event.data?.after.exists
      ? (event.data.after.data() as SuspendableEmployee)
      : undefined;

    // A deleted employee is handled by onEmployeeDeleted, which unlinks the
    // user; their claims go with the link, not with this flag.
    if (after === undefined) return;

    // The gate: a salary edit must not cost a token rewrite.
    if (!suspensionChanged(before, after)) return;

    const uid = suspendedUserId(after);
    if (uid === null) {
      logger.warn("onEmployeeSuspensionChanged: employee names no user", { employeeId });
      return;
    }

    const suspended = isSuspended(after);

    let existing: Record<string, unknown>;
    try {
      existing = (await auth().getUser(uid)).customClaims ?? {};
    } catch (error) {
      // An employee record can outlive its auth account; there is no token to
      // put a claim on, and retrying will not change that.
      if ((error as { code?: string })?.code === "auth/user-not-found") {
        logger.warn("onEmployeeSuspensionChanged: no auth account", { employeeId, uid });
        return;
      }
      throw error;
    }

    await auth().setCustomUserClaims(uid, nextSuspensionClaims(existing, suspended));

    // Ordered after the claim write, so a client woken by this finds the new
    // claim already in place — same contract as syncRoleClaim.
    await db()
      .collection(CLAIMS_METADATA_COLLECTION)
      .doc(uid)
      .set({ refreshTime: FieldValue.serverTimestamp() }, { merge: true });

    logger.info("onEmployeeSuspensionChanged: claim updated", {
      employeeId,
      uid,
      suspended,
    });
  }
);
