/**
 * What has to happen to the rest of the database when an employee record goes.
 *
 * `employeeAPI.terminateEmpById` already unlinks equipment, clears the user's
 * link and deletes the leave balances it can see. Three things it cannot do
 * safely from a browser are left over, and they are why this runs server-side:
 *
 * 1. **Orphaned dependents.** `leaveRequests`, `meetings` and
 *    `performanceReviews` all carry an `employeeId` and none of them are
 *    touched. After a termination they point at a document that no longer
 *    exists, while still carrying a denormalised `employeeName` that makes them
 *    render as though the employee were still there.
 * 2. **Stranded subcollections.** Deleting a Firestore document does *not*
 *    delete its subcollections. An employee deleted from the Firebase console
 *    leaves `employees/{id}/leaveBalances/*` behind forever — and
 *    `pageAPI.getAdminEmpManagement` reads every leave balance through a
 *    collection-group query, so those strays keep skewing admin aggregates.
 * 3. **Partial cascades.** A browser tab that closes halfway through leaves the
 *    job half done, with nothing to resume it.
 *
 * The cascade is declared as data below and executed by {@link runCascade}, so
 * the policy can be read and tested without reaching for an emulator.
 */

import { chunk, MAX_BATCH_OPERATIONS } from "../shared/chunk";

/** One step of a cascade, keyed on the field holding the departed id. */
export type CascadeStep =
  /** Remove the dependent documents outright. */
  | { kind: "delete"; collection: string; field: string }
  /**
   * Keep the documents but null out the fields naming the departed record —
   * equipment outlives the person it was issued to.
   */
  | { kind: "clear"; collection: string; field: string; fields: readonly string[] };

/**
 * The cascade for a deleted `employees/{employeeId}`.
 *
 * Deliberately covers ground `terminateEmpById` already covers: this trigger
 * also fires for a console deletion or a direct Admin SDK write, where none of
 * the client-side cleanup has run. Repeating a completed step is a no-op, so
 * the overlap costs a query and buys correctness for every deletion path.
 */
export const EMPLOYEE_CASCADE: readonly CascadeStep[] = [
  // A leave request's whole meaning is the employee who made it.
  { kind: "delete", collection: "leaveRequests", field: "employeeId" },
  // Gatherings are between an admin and an employee; with one gone there is no
  // meeting left to hold, and the admin screens read them by employee.
  { kind: "delete", collection: "meetings", field: "employeeId" },
  { kind: "delete", collection: "performanceReviews", field: "employeeId" },
  // Equipment is company property: it returns to the unassigned pool rather
  // than being destroyed. Matches what terminateEmpById does.
  {
    kind: "clear",
    collection: "equipment",
    field: "employeeId",
    fields: ["employeeId", "assignedDate"],
  },
];

/**
 * The user document pointing at the departed employee. Split out from
 * {@link EMPLOYEE_CASCADE} because it also has to flip `isLinked`, which is a
 * value rather than a null.
 */
export const USER_UNLINK_FIELDS = { isLinked: false, employeeId: null } as const;

/** The subcollections under `employees/{id}` that a document delete leaves behind. */
export const EMPLOYEE_SUBCOLLECTIONS = ["leaveBalances"] as const;

/** A document the cascade has decided to act on. */
export interface CascadeTarget {
  collection: string;
  id: string;
}

/** The Firestore operations a cascade needs, named for what it uses them for. */
export interface CascadeBackend {
  /** Ids of documents in `collection` whose `field` equals `value`. */
  findByField(collection: string, field: string, value: string): Promise<string[]>;

  /** Ids of every document in a subcollection under `employees/{employeeId}`. */
  listSubcollection(employeeId: string, subcollection: string): Promise<string[]>;

  /** Deletes the given documents. Never called with more than 500 at a time. */
  deleteAll(collection: string, ids: readonly string[]): Promise<void>;

  /** Deletes documents from a subcollection under an employee. */
  deleteSubcollectionDocs(
    employeeId: string,
    subcollection: string,
    ids: readonly string[]
  ): Promise<void>;

  /** Merges `data` into the given documents. Never called with more than 500 at a time. */
  updateAll(
    collection: string,
    ids: readonly string[],
    data: Record<string, unknown>
  ): Promise<void>;
}

/** What a cascade did, for the log line and for tests to assert on. */
export interface CascadeReport {
  deleted: Record<string, number>;
  cleared: Record<string, number>;
  /** Documents removed from `employees/{id}/<sub>`. */
  subcollections: Record<string, number>;
}

/** Turns a step's `fields` list into the `{ field: null }` update it implies. */
const nullsFor = (fields: readonly string[]): Record<string, null> =>
  Object.fromEntries(fields.map((field) => [field, null]));

/**
 * Runs a cascade for one departed employee.
 *
 * Steps run in sequence rather than in parallel: a cascade is rare and a
 * partial failure is far easier to reason about when the report says exactly
 * how far it got. Each step chunks its own writes to stay under the batch cap.
 */
export const runCascade = async (
  employeeId: string,
  backend: CascadeBackend,
  steps: readonly CascadeStep[] = EMPLOYEE_CASCADE,
  subcollections: readonly string[] = EMPLOYEE_SUBCOLLECTIONS
): Promise<CascadeReport> => {
  const report: CascadeReport = { deleted: {}, cleared: {}, subcollections: {} };

  for (const step of steps) {
    const ids = await backend.findByField(step.collection, step.field, employeeId);
    if (ids.length === 0) continue;

    for (const batch of chunk(ids, MAX_BATCH_OPERATIONS)) {
      if (step.kind === "delete") {
        await backend.deleteAll(step.collection, batch);
      } else {
        await backend.updateAll(step.collection, batch, nullsFor(step.fields));
      }
    }

    const tally = step.kind === "delete" ? report.deleted : report.cleared;
    tally[step.collection] = (tally[step.collection] ?? 0) + ids.length;
  }

  // Subcollections last: they hang off the deleted document itself, so nothing
  // else in the cascade depends on them still being there.
  for (const subcollection of subcollections) {
    const ids = await backend.listSubcollection(employeeId, subcollection);
    if (ids.length === 0) continue;

    for (const batch of chunk(ids, MAX_BATCH_OPERATIONS)) {
      await backend.deleteSubcollectionDocs(employeeId, subcollection, batch);
    }
    report.subcollections[subcollection] = ids.length;
  }

  return report;
};
