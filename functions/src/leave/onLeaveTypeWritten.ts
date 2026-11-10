/**
 * `onLeaveTypeWritten` — propagates a leave type change to every employee's
 * balances.
 *
 * See `leaveTypeSync.ts` for what each case does and why. The short version:
 * adding a leave type used to reach nobody, which let approved leave go
 * undeducted, and renaming one left every balance displaying the old name.
 */

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";

import {
  mirrorUpdate,
  newBalance,
  planLeaveTypeSync,
  type LeaveTypeDoc,
} from "./leaveTypeSync";
import { chunk } from "../shared/chunk";
import { db } from "../shared/admin";

/** `getAll` takes a variable argument list; keep each call to a sane size. */
const READ_CHUNK = 300;

const balanceRef = (employeeId: string, leaveTypeId: string) =>
  db()
    .collection("employees")
    .doc(employeeId)
    .collection("leaveBalances")
    .doc(leaveTypeId);

/** Every employee id. `select()` with no fields fetches ids only. */
const listEmployeeIds = async (): Promise<string[]> => {
  const snapshot = await db().collection("employees").select().get();
  return snapshot.docs.map((doc) => doc.id);
};

/**
 * Which of `employeeIds` already hold a balance for this leave type.
 *
 * A batched `getAll` rather than a collection-group query: the balance document
 * id *is* the leave type id, so the lookup is exact and needs no index.
 * Membership is taken from each snapshot's own path rather than its position,
 * so nothing depends on `getAll` preserving order.
 */
const employeesWithBalance = async (
  employeeIds: readonly string[],
  leaveTypeId: string
): Promise<Set<string>> => {
  const found = new Set<string>();

  for (const batch of chunk(employeeIds, READ_CHUNK)) {
    const snapshots = await db().getAll(
      ...batch.map((employeeId) => balanceRef(employeeId, leaveTypeId))
    );

    for (const snapshot of snapshots) {
      const employeeId = snapshot.ref.parent.parent?.id;
      if (snapshot.exists && employeeId) found.add(employeeId);
    }
  }

  return found;
};

export const onLeaveTypeWritten = onDocumentWritten(
  "leaveTypes/{leaveTypeId}",
  async (event) => {
    const leaveTypeId = event.params.leaveTypeId;

    const before = event.data?.before.exists
      ? (event.data.before.data() as LeaveTypeDoc)
      : undefined;
    const after = event.data?.after.exists
      ? (event.data.after.data() as LeaveTypeDoc)
      : undefined;

    // A write with neither side is not something to act on.
    if (before === undefined && after === undefined) return;

    const employeeIds = await listEmployeeIds();
    if (employeeIds.length === 0) return;

    const existing = await employeesWithBalance(employeeIds, leaveTypeId);
    const plan = planLeaveTypeSync(leaveTypeId, before, after, employeeIds, existing);

    if (
      plan.toCreate.length === 0 &&
      plan.toUpdate.length === 0 &&
      plan.toDelete.length === 0
    ) {
      logger.debug("onLeaveTypeWritten: nothing to propagate", { leaveTypeId });
      return;
    }

    if (plan.fields !== null) {
      const created = newBalance(plan.fields);
      for (const batch of chunk(plan.toCreate)) {
        const write = db().batch();
        batch.forEach((employeeId) =>
          write.set(balanceRef(employeeId, leaveTypeId), created)
        );
        await write.commit();
      }

      const updated = mirrorUpdate(plan.fields);
      for (const batch of chunk(plan.toUpdate)) {
        const write = db().batch();
        batch.forEach((employeeId) =>
          // merge rather than update: a balance deleted since the read above
          // would make an update reject the whole batch.
          write.set(balanceRef(employeeId, leaveTypeId), updated, { merge: true })
        );
        await write.commit();
      }
    }

    for (const batch of chunk(plan.toDelete)) {
      const write = db().batch();
      batch.forEach((employeeId) => write.delete(balanceRef(employeeId, leaveTypeId)));
      await write.commit();
    }

    logger.info("onLeaveTypeWritten: balances synced", {
      leaveTypeId,
      created: plan.toCreate.length,
      updated: plan.toUpdate.length,
      deleted: plan.toDelete.length,
    });
  }
);
