/**
 * Making `Employee.isSuspended` mean something.
 *
 * The field is in the ER diagram, an admin toggles it through
 * `employeeAPI.toggleEmpSuspension`, and the UI shows a "Suspended" badge — but
 * nothing has ever *enforced* it. Every reference in `src/` is display: a badge,
 * a line in the payroll PDF, a dashboard tally. A suspended employee could still
 * sign in, file leave requests, request meetings and edit their profile.
 *
 * **This is inferred, not ported.** The CoriCore source is not available, so
 * whether its middleware refused suspended users cannot be checked. What is
 * certain is that a button labelled "Suspend" that changes nothing but a badge
 * is not the intent. The reading taken here is the narrow one: suspension stops
 * an employee *writing*, and leaves their reads alone, so they can still see
 * their own record while being unable to file anything new. Admins are
 * unaffected — they have to be able to act on a suspended employee.
 *
 * Suspension rides on the ID token rather than being read from the employee
 * document by the rules, because a `get()` on every evaluation is exactly the
 * cost `syncRoleClaim` exists to avoid.
 *
 * The key is deliberately outside `MANAGED_CLAIMS` in `roleClaims.ts`, so the
 * two claim writers compose instead of fighting: `syncRoleClaim` rewrites the
 * role keys and preserves this one, and this preserves the role keys.
 */

/** The claim key. Present only while suspended, to keep the token small. */
export const SUSPENDED_CLAIM = "suspended";

/** The part of an `employees/{id}` document this cares about. */
export interface SuspendableEmployee {
  isSuspended?: unknown;
  userId?: unknown;
}

/**
 * Whether the employee counts as suspended.
 *
 * Only a literal `true` suspends. A missing field, a null, or the string
 * "false" must not lock someone out of their own account — this is the
 * direction where being wrong is expensive.
 */
export const isSuspended = (employee: SuspendableEmployee | undefined): boolean =>
  employee?.isSuspended === true;

/** The uid to move the claim on, or null when the record names no user. */
export const suspendedUserId = (employee: SuspendableEmployee | undefined): string | null =>
  typeof employee?.userId === "string" && employee.userId.length > 0
    ? employee.userId
    : null;

/**
 * The claims to write, given the existing set.
 *
 * Touches only {@link SUSPENDED_CLAIM}: `setCustomUserClaims` replaces the whole
 * object, so everything else — the role keys `syncRoleClaim` owns included —
 * has to be carried through verbatim. The key is removed rather than set to
 * `false` when the employee is reinstated, so the rules' `== true` test never
 * meets a stale falsey value and the token stays minimal.
 */
export const nextSuspensionClaims = (
  existing: Record<string, unknown> | undefined,
  suspended: boolean
): Record<string, unknown> => {
  const result: Record<string, unknown> = { ...(existing ?? {}) };

  if (suspended) result[SUSPENDED_CLAIM] = true;
  else delete result[SUSPENDED_CLAIM];

  return result;
};

/** Whether the suspension state actually moved between two versions. */
export const suspensionChanged = (
  before: SuspendableEmployee | undefined,
  after: SuspendableEmployee | undefined
): boolean => isSuspended(before) !== isSuspended(after);
