/**
 * `onLeaveRequestWritten` — stamps a validation verdict onto a leave request.
 *
 * The rules enforce what a single document can prove about itself. This covers
 * the two checks that need other documents — overlapping requests and the leave
 * balance — and records the answer on the request as `validation`, so an admin
 * screen can show it without changing how requests are read or written.
 *
 * It is advisory by design. Over-drawing a balance is a supported flow, with
 * `OverBalanceConfirmModal` already warning the admin, so this informs the
 * decision rather than blocking it.
 *
 * **Loop safety.** This function writes to the collection that triggers it. The
 * guard is that it writes *only* when the computed verdict differs from the one
 * already stored: its own write fires the trigger once more, that run computes
 * an identical verdict, and it stops. The verdict therefore must not contain
 * anything that varies between runs — notably no timestamp, which would make
 * every comparison unequal and never terminate.
 */

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";

import {
  validateLeaveRequest,
  verdictsEqual,
  type LeaveRequestDoc,
  type LeaveVerdict,
  type OtherRequest,
} from "./leaveRequestValidation";
import { db } from "../shared/admin";

/** The field the verdict is written to. */
export const VERDICT_FIELD = "validation";

/** Every other request belonging to the same employee. */
const otherRequestsFor = async (
  employeeId: string,
  excludeId: string
): Promise<OtherRequest[]> => {
  // A single equality filter, so the automatic single-field index covers it —
  // no entry needed in firestore.indexes.json.
  const snapshot = await db()
    .collection("leaveRequests")
    .where("employeeId", "==", employeeId)
    .get();

  return snapshot.docs
    .filter((doc) => doc.id !== excludeId)
    .map((doc) => ({ id: doc.id, ...(doc.data() as LeaveRequestDoc) }));
};

/** The employee's remaining days for a leave type, or undefined if none exists. */
const remainingDaysFor = async (
  employeeId: string,
  leaveTypeId: string
): Promise<number | undefined> => {
  const snapshot = await db()
    .collection("employees")
    .doc(employeeId)
    .collection("leaveBalances")
    .doc(leaveTypeId)
    .get();

  if (!snapshot.exists) return undefined;

  const remaining = snapshot.data()?.remainingDays;
  return typeof remaining === "number" ? remaining : undefined;
};

export const onLeaveRequestWritten = onDocumentWritten(
  "leaveRequests/{requestId}",
  async (event) => {
    const requestId = event.params.requestId;

    // Nothing to validate on a delete; onEmployeeDeleted handles the cascade.
    if (!event.data?.after.exists) return;

    const request = event.data.after.data() as LeaveRequestDoc & {
      validation?: LeaveVerdict;
    };

    const employeeId = request.employeeId;
    const leaveTypeId = request.leaveTypeId;

    if (typeof employeeId !== "string" || employeeId.length === 0) {
      logger.warn("onLeaveRequestWritten: request has no employeeId", { requestId });
      return;
    }

    const [others, remainingDays] = await Promise.all([
      otherRequestsFor(employeeId, requestId),
      typeof leaveTypeId === "string" && leaveTypeId.length > 0
        ? remainingDaysFor(employeeId, leaveTypeId)
        : Promise.resolve(undefined),
    ]);

    const verdict = validateLeaveRequest(request, others, remainingDays);

    // The loop guard. Also the common case: most writes do not change the
    // verdict, and this run is then a pair of reads and nothing else.
    if (verdictsEqual(request.validation, verdict)) return;

    await event.data.after.ref.update({ [VERDICT_FIELD]: verdict });

    if (!verdict.valid) {
      logger.warn("onLeaveRequestWritten: request has issues", {
        requestId,
        employeeId,
        issues: verdict.issues.map((issue) => issue.code),
      });
    } else {
      logger.debug("onLeaveRequestWritten: request validated clean", { requestId });
    }
  }
);
