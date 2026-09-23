/**
 * Writing a denormalisation fan-out with the Admin SDK.
 *
 * The decisions live in `denormalise.ts`; this is the part that touches
 * Firestore. Each spec becomes one equality query and a chunked batch write.
 */

import { chunk } from "./chunk";
import type { MirrorSpec } from "./denormalise";
import { db } from "./admin";

/** How many documents each collection had rewritten. */
export type MirrorReport = Record<string, number>;

/**
 * Applies each pending update to every document naming `sourceId`.
 *
 * Every query is a single equality filter, so the automatic single-field index
 * covers them and `firestore.indexes.json` needs no new entry.
 */
export const applyMirrors = async (
  sourceId: string,
  pending: ReadonlyArray<{ spec: MirrorSpec; update: Record<string, unknown> }>
): Promise<MirrorReport> => {
  const report: MirrorReport = {};

  for (const { spec, update } of pending) {
    const snapshot = await db()
      .collection(spec.collection)
      .where(spec.matchField, "==", sourceId)
      .select()
      .get();

    const ids = snapshot.docs.map((doc) => doc.id);
    if (ids.length === 0) continue;

    for (const batch of chunk(ids)) {
      const write = db().batch();
      batch.forEach((id) =>
        // merge rather than update: a document deleted between the read and the
        // write would otherwise reject the whole batch.
        write.set(db().collection(spec.collection).doc(id), update, { merge: true })
      );
      await write.commit();
    }

    report[spec.collection] = ids.length;
  }

  return report;
};
