/**
 * `onUserProfileWritten` — pushes a user's profile down to their employee and
 * admin records.
 *
 * `employeeAPI.updateEmpUserById` mirrors *employee to user*, and only for the
 * three fields it is given. The other direction has no path at all:
 *
 * - `linkUserAsAdmin` copies `fullName` and `email` onto the admin record once,
 *   at link time, and nothing ever refreshes them. An admin who changes their
 *   name keeps the old one on every meeting and review they run.
 * - A user document edited anywhere other than `updateEmpUserById` — the
 *   Firebase console, `scripts/seed.mjs`, a future auth-profile sync — reaches
 *   the employee record not at all.
 *
 * This is the first hop. Writing to `employees` / `admins` then wakes
 * `onEmployeeProfileWritten` / `onAdminProfileWritten`, which carry the name out
 * to the gatherings and leave requests that copied it. Neither of those writes
 * back to `users`, so the chain terminates.
 */

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";

import {
  USER_TO_ADMIN_FIELDS,
  USER_TO_EMPLOYEE_FIELDS,
  changedFields,
  pickFields,
} from "../shared/denormalise";
import { db } from "../shared/admin";

/** Every field this trigger might hand down, for the change gate. */
const WATCHED = [
  ...new Set([...USER_TO_EMPLOYEE_FIELDS, ...USER_TO_ADMIN_FIELDS]),
] as const;

export const onUserProfileWritten = onDocumentWritten("users/{uid}", async (event) => {
  const before = event.data?.before.exists ? event.data.before.data() : undefined;
  const after = event.data?.after.exists ? event.data.after.data() : undefined;

  // onUserDeleted owns the delete path. A create carries no link yet — the role
  // and ids are written later, by setupUserAsEmployee or linkUserAsAdmin.
  if (before === undefined || after === undefined) return;

  const changed = changedFields(before, after, WATCHED);
  if (changed.length === 0) return;

  const employeeId = typeof after.employeeId === "string" ? after.employeeId : null;
  const adminId = typeof after.adminId === "string" ? after.adminId : null;
  if (employeeId === null && adminId === null) return;

  const written: string[] = [];

  if (employeeId !== null) {
    const update = pickFields(
      after,
      USER_TO_EMPLOYEE_FIELDS.filter((field) => changed.includes(field))
    );
    if (Object.keys(update).length > 0) {
      // merge rather than update: the linked record may have been deleted since
      // the user document last named it.
      await db().collection("employees").doc(employeeId).set(update, { merge: true });
      written.push("employees");
    }
  }

  if (adminId !== null) {
    const update = pickFields(
      after,
      USER_TO_ADMIN_FIELDS.filter((field) => changed.includes(field))
    );
    if (Object.keys(update).length > 0) {
      await db().collection("admins").doc(adminId).set(update, { merge: true });
      written.push("admins");
    }
  }

  if (written.length > 0) {
    logger.info("onUserProfileWritten: profile handed down", {
      uid: event.params.uid,
      changed,
      written,
    });
  }
});
