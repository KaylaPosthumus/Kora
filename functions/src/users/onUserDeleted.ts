/**
 * `onUserDeleted` — removes the Firestore records a deleted auth account leaves.
 *
 * This is a **v1** trigger. Auth account lifecycle events have no v2 equivalent:
 * `firebase-functions/v2/identity` offers only the blocking `beforeUserCreated`
 * and `beforeUserSignedIn` hooks, and neither fires on deletion. Mixing v1 and
 * v2 in one codebase is supported, so the rest of this backend stays on v2.
 *
 * See `userCleanup.ts` for what is removed, and why the employee record is
 * unlinked rather than deleted.
 */

// A named import, not a default: `firebase-functions/v1` is a CommonJS
// namespace with no default export, so `import functionsV1 from …` compiles to
// `undefined` under esModuleInterop and fails at load time rather than at build.
import { auth as authTriggers } from "firebase-functions/v1";
import { logger } from "firebase-functions";

import { cleanUpDeletedUser, type UserCleanupBackend } from "./userCleanup";
import { db } from "../shared/admin";

/** {@link UserCleanupBackend} backed by the Admin SDK. */
export const adminUserCleanupBackend = (): UserCleanupBackend => ({
  readUser: async (uid) => {
    const snapshot = await db().collection("users").doc(uid).get();
    return snapshot.exists ? (snapshot.data() as { employeeId?: unknown }) : undefined;
  },

  deleteUserDoc: async (uid) => {
    await db().collection("users").doc(uid).delete();
  },

  // Deleting an absent document is already a no-op in Firestore, which is what
  // makes a redelivered event harmless.
  deleteByUid: async (collection, uid) => {
    await db().collection(collection).doc(uid).delete();
  },

  unlinkEmployee: async (employeeId) => {
    // set/merge rather than update: the employee record may already be gone,
    // and update would throw where this should simply do nothing meaningful.
    await db()
      .collection("employees")
      .doc(employeeId)
      .set({ userId: null }, { merge: true });
  },
});

export const onUserDeleted = authTriggers.user().onDelete(async (user) => {
  const report = await cleanUpDeletedUser(user.uid, adminUserCleanupBackend());

  logger.info("onUserDeleted: cleanup complete", { uid: user.uid, ...report });
});
