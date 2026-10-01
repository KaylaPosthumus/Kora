/**
 * `onAdminDeleted` — unlinks a departed admin from their gatherings.
 *
 * See `adminCascade.ts` for why nothing is deleted here, unlike
 * `onEmployeeDeleted`.
 */

import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";

import { ADMIN_CASCADE, ADMIN_USER_UNLINK_FIELDS } from "./adminCascade";
import { runSteps, type StepBackend } from "../shared/cascade";
import { chunk } from "../shared/chunk";
import { db } from "../shared/admin";

/** {@link StepBackend} backed by the Admin SDK. */
export const adminStepBackend = (): StepBackend => ({
  findByField: async (collection, field, value) => {
    const snapshot = await db().collection(collection).where(field, "==", value).select().get();
    return snapshot.docs.map((doc) => doc.id);
  },

  deleteAll: async (collection, ids) => {
    const batch = db().batch();
    ids.forEach((id) => batch.delete(db().collection(collection).doc(id)));
    await batch.commit();
  },

  updateAll: async (collection, ids, data) => {
    const batch = db().batch();
    ids.forEach((id) => batch.update(db().collection(collection).doc(id), data));
    await batch.commit();
  },
});

/**
 * Unlinks the user account(s) that pointed at this admin.
 *
 * Queries by `adminId` rather than trusting the deleted document's `userId`, so
 * a half-written record is still cleaned up; the `userId` is a fallback for when
 * the query finds nothing.
 */
export const unlinkAdminUsers = async (
  adminId: string,
  userId?: string
): Promise<number> => {
  const snapshot = await db()
    .collection("users")
    .where("adminId", "==", adminId)
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
      write.set(db().collection("users").doc(id), ADMIN_USER_UNLINK_FIELDS, { merge: true })
    );
    await write.commit();
  }

  return ids.length;
};

export const onAdminDeleted = onDocumentDeleted("admins/{adminId}", async (event) => {
  const adminId = event.params.adminId;
  const deleted = event.data?.data() as { userId?: string } | undefined;

  const report = await runSteps(adminId, adminStepBackend(), ADMIN_CASCADE);
  const unlinked = await unlinkAdminUsers(adminId, deleted?.userId);

  logger.info("onAdminDeleted: gatherings unlinked", {
    adminId,
    ...report,
    usersUnlinked: unlinked,
  });
});
