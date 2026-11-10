/**
 * Running a declarative cascade over documents that reference a departed record.
 *
 * Extracted from `employees/employeeCascade.ts` once admins needed the same
 * shape: find the documents pointing at an id, then either remove them or null
 * the fields that named it, chunked to stay inside Firestore's batch cap.
 *
 * What differs between subjects is *policy* — which collections, and delete
 * versus clear — so that stays as data in each area's own module.
 */

import { chunk, MAX_BATCH_OPERATIONS } from "./chunk";

/** One step of a cascade, keyed on the field holding the departed id. */
export type CascadeStep =
  /** Remove the dependent documents outright. */
  | { kind: "delete"; collection: string; field: string }
  /** Keep the documents but null the fields naming the departed record. */
  | { kind: "clear"; collection: string; field: string; fields: readonly string[] };

/** The Firestore operations a cascade needs. */
export interface StepBackend {
  /** Ids of documents in `collection` whose `field` equals `value`. */
  findByField(collection: string, field: string, value: string): Promise<string[]>;

  /** Deletes the given documents. Never called with more than 500 at a time. */
  deleteAll(collection: string, ids: readonly string[]): Promise<void>;

  /** Merges `data` into the given documents. Never called with more than 500 at a time. */
  updateAll(
    collection: string,
    ids: readonly string[],
    data: Record<string, unknown>
  ): Promise<void>;
}

/** How many documents each step touched, by collection. */
export interface StepReport {
  deleted: Record<string, number>;
  cleared: Record<string, number>;
}

/** Turns a step's `fields` list into the `{ field: null }` update it implies. */
const nullsFor = (fields: readonly string[]): Record<string, null> =>
  Object.fromEntries(fields.map((field) => [field, null]));

/**
 * Applies every step for one departed id.
 *
 * Steps run in sequence rather than in parallel: a cascade is rare, and a
 * partial failure is far easier to reason about when the report says exactly
 * how far it got.
 */
export const runSteps = async (
  id: string,
  backend: StepBackend,
  steps: readonly CascadeStep[]
): Promise<StepReport> => {
  const report: StepReport = { deleted: {}, cleared: {} };

  for (const step of steps) {
    const ids = await backend.findByField(step.collection, step.field, id);
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

  return report;
};
