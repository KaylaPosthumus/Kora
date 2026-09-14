/**
 * Propagating a renamed person through the documents that copied their name.
 *
 * CLAUDE.md states the rule: "fields that appear in lists are denormalised onto
 * the listed document… When you write to one side of a denormalised pair, mirror
 * it." `updateEmpUserById` does that for the one pair it touches. Nothing keeps
 * the rest in step, and the chain is two hops deep:
 *
 * ```
 * users.fullName ─┬─> employees.fullName ──> leaveRequests.employeeName
 *                 │                          meetings.employeeName
 *                 │                          performanceReviews.employeeName
 *                 └─> admins.fullName ─────> meetings.adminName
 *                                            performanceReviews.adminName
 * ```
 *
 * So an employee who changes their name keeps the old one on every leave request
 * an admin reviews, and `linkUserAsAdmin` copies `fullName` once and never again.
 *
 * This module is the fan-out half: given a changed source document, which target
 * collections need which fields rewritten. The direct one-document hops
 * (`users` to `employees`/`admins`) are simple enough to live in their trigger.
 */

/** One collection that copies fields from a source document. */
export interface MirrorSpec {
  collection: string;
  /** The field on the target holding the source document's id. */
  matchField: string;
  /** Source field name -> the name it is stored under on the target. */
  fields: Readonly<Record<string, string>>;
}

/** Fields on `employees` that other documents copy. */
export const EMPLOYEE_MIRRORS: readonly MirrorSpec[] = [
  {
    collection: "leaveRequests",
    matchField: "employeeId",
    fields: { fullName: "employeeName" },
  },
  { collection: "meetings", matchField: "employeeId", fields: { fullName: "employeeName" } },
  {
    collection: "performanceReviews",
    matchField: "employeeId",
    fields: { fullName: "employeeName" },
  },
];

/** Fields on `admins` that other documents copy. */
export const ADMIN_MIRRORS: readonly MirrorSpec[] = [
  { collection: "meetings", matchField: "adminId", fields: { fullName: "adminName" } },
  {
    collection: "performanceReviews",
    matchField: "adminId",
    fields: { fullName: "adminName" },
  },
];

/** What `users` hands down, and where. */
export const USER_TO_EMPLOYEE_FIELDS = ["fullName", "email", "profilePicture"] as const;
export const USER_TO_ADMIN_FIELDS = ["fullName", "email"] as const;

/**
 * Which of `fields` differ between two versions of a document.
 *
 * The gate on the whole fan-out: an employee's salary changing must not send
 * three queries looking for a name that did not move.
 */
export const changedFields = (
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: readonly string[]
): string[] => fields.filter((field) => before[field] !== after[field]);

/**
 * The update to apply to a spec's targets, or null when nothing it copies moved.
 *
 * `undefined` is normalised to null: Firestore rejects an explicit undefined,
 * and a name that has been cleared should land as an absent value rather than
 * failing the write.
 */
export const mirrorUpdate = (
  spec: MirrorSpec,
  after: Record<string, unknown>,
  changed: readonly string[]
): Record<string, unknown> | null => {
  const update: Record<string, unknown> = {};

  for (const [sourceField, targetField] of Object.entries(spec.fields)) {
    if (changed.includes(sourceField)) {
      update[targetField] = after[sourceField] ?? null;
    }
  }

  return Object.keys(update).length > 0 ? update : null;
};

/** Every spec with something to write, paired with its update. */
export const pendingMirrors = (
  specs: readonly MirrorSpec[],
  after: Record<string, unknown>,
  changed: readonly string[]
): Array<{ spec: MirrorSpec; update: Record<string, unknown> }> =>
  specs
    .map((spec) => ({ spec, update: mirrorUpdate(spec, after, changed) }))
    .filter(
      (entry): entry is { spec: MirrorSpec; update: Record<string, unknown> } =>
        entry.update !== null
    );

/** The subset of `fields` present on a document, normalised for writing. */
export const pickFields = (
  source: Record<string, unknown>,
  fields: readonly string[]
): Record<string, unknown> =>
  Object.fromEntries(fields.map((field) => [field, source[field] ?? null]));
