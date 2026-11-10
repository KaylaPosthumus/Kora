/**
 * What happens to gatherings when an admin record is deleted.
 *
 * Deliberately *unlike* `onEmployeeDeleted`, which removes the dependents. A
 * leave request has no meaning without the employee who filed it, but a
 * performance review is a record **about the employee** — its rating, comment
 * and document are their history, and the admin who conducted it is incidental.
 * Deleting an employee's review history because an admin left would destroy the
 * more valuable half of the record.
 *
 * So nothing is deleted. `adminId` is nulled so it stops pointing at a document
 * that no longer exists, and `adminName` is kept: it is the historical fact of
 * who ran the meeting or review.
 *
 * The cost of nulling rather than leaving it dangling is that these rows stop
 * matching `where("adminId", "==", …)`, so they vanish from per-admin screens.
 * That is the correct outcome — the admin is gone — and it leaves them findable
 * as `adminId == null` for a reassignment view.
 */

import type { CascadeStep } from "../shared/cascade";

export const ADMIN_CASCADE: readonly CascadeStep[] = [
  // Kept, with the admin unlinked. `adminName` deliberately survives.
  { kind: "clear", collection: "meetings", field: "adminId", fields: ["adminId"] },
  {
    kind: "clear",
    collection: "performanceReviews",
    field: "adminId",
    fields: ["adminId"],
  },
];

/**
 * The user document that pointed at the departed admin. Separate from the
 * cascade because it flips `isLinked` and `role`, values rather than nulls —
 * the same split `employeeCascade.ts` makes.
 *
 * **`role` is the one that matters.** `isAdmin()` in `firestore.rules` resolves
 * a caller's role from `request.auth.token.role` *or* `users/{uid}.role`, so
 * clearing only `adminId` leaves a deleted admin holding org-wide read and
 * write over every salary and ID number in the database, with no admin record
 * behind it. `syncRoleClaim` would also re-derive the admin claim from the
 * document it left behind.
 *
 * Demoted to `unassigned` rather than deleted, matching what signup writes: the
 * account still exists and can sign in, it simply has no privileges until an
 * admin links it again.
 */
export const ADMIN_USER_UNLINK_FIELDS = {
  isLinked: false,
  adminId: null,
  role: "unassigned",
} as const;
