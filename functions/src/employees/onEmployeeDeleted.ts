/**
 * `onEmployeeDeleted` — cleans up after a removed employee record.
 *
 * Fires for every deletion path, not just `employeeAPI.terminateEmpById`: a
 * console delete, a seed re-run and an Admin SDK write all reach it, and none of
 * those run the client-side cleanup. See `employeeCascade.ts` for what it
 * removes and why each step is there.
 */

import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";

import {
  runCascade,
  USER_UNLINK_FIELDS,
  type CascadeBackend,
} from "./employeeCascade";
import { chunk } from "../shared/chunk";
import { db } from "../shared/admin";

/** {@link CascadeBackend} backed by the Admin SDK. */
export const adminCascadeBackend = (): CascadeBackend => ({
  findByField: async (collection, field, value) => {
    // `select()` with no fields fetches ids only — the cascade never reads the
    // documents it is about to delete.
    const snapshot = await db().collection(collection).where(field, "==", value).select().get();
    return snapshot.docs.map((doc) => doc.id);
  },

  listSubcollection: async (employeeId, subcollection) => {
    const snapshot = await db()
      .collection("employees")
      .doc(employeeId)
      .collection(subcollection)
      .select()
      .get();
    return snapshot.docs.map((doc) => doc.id);
  },

  deleteAll: async (collection, ids) => {
    const batch = db().batch();
    ids.forEach((id) => batch.delete(db().collection(collection).doc(id)));
    await batch.commit();
  },

  deleteSubcollectionDocs: async (employeeId, subcollection, ids) => {
    const parent = db().collection("employees").doc(employeeId).collection(subcollection);
    const batch = db().batch();
    ids.forEach((id) => batch.delete(parent.doc(id)));
    await batch.commit();
  },

  updateAll: async (collection, ids, data) => {
    const batch = db().batch();
    ids.forEach((id) => batch.update(db().collection(collection).doc(id), data));
    await batch.commit();
  },
});

/**
 * Unlinks the user account(s) that pointed at this employee.
 *
 * Kept out of the declarative cascade because it writes a value (`isLinked:
 * false`) rather than nulling fields. Queries by `employeeId` instead of
 * trusting the deleted document's `userId`, so a half-written record still gets
 * cleaned up; the `userId` is used only as a fallback when the index-backed
 * query finds nothing.
 */
export const unlinkUsers = async (employeeId: string, userId?: string): Promise<number> => {
  const snapshot = await db()
    .collection("users")
    .where("employeeId", "==", employeeId)
    .select()
    .get();

  const ids = snapshot.docs.map((doc) => doc.id);
  if (ids.length === 0 && typeof userId === "string" && userId.length > 0) {
    ids.push(userId);
  }
  if (ids.length === 0) return 0;

  for (const batch of chunk(ids)) {
    const write = db().batch();
    batch.forEach((id) =>
      // set/merge rather than update: the fallback id may name a user document
      // that no longer exists, and update would reject the whole batch.
      write.set(db().collection("users").doc(id), USER_UNLINK_FIELDS, { merge: true })
    );
    await write.commit();
  }

  return ids.length;
};

export const onEmployeeDeleted = onDocumentDeleted(
  "employees/{employeeId}",
  async (event) => {
    const employeeId = event.params.employeeId;
    const deleted = event.data?.data() as { userId?: string } | undefined;

    const report = await runCascade(employeeId, adminCascadeBackend());
    const unlinked = await unlinkUsers(employeeId, deleted?.userId);

    logger.info("onEmployeeDeleted: cascade complete", {
      employeeId,
      ...report,
      usersUnlinked: unlinked,
    });
  }
);
