/**
 * Splitting work to fit a Firestore write batch.
 *
 * A batch (and a transaction) accepts at most 500 operations. The browser code
 * gets away with ignoring that because it cascades over one employee's handful
 * of documents; a server-side cascade runs over whatever has accumulated, so it
 * has to chunk or it will fail on exactly the accounts that matter most.
 */

/** Firestore's hard cap on operations in a single `WriteBatch`. */
export const MAX_BATCH_OPERATIONS = 500;

/**
 * Splits `items` into runs of at most `size`.
 *
 * An empty input yields no chunks — callers can commit each chunk
 * unconditionally without first checking for an empty batch.
 */
export const chunk = <T>(items: readonly T[], size = MAX_BATCH_OPERATIONS): T[][] => {
  if (size < 1) throw new RangeError(`chunk size must be at least 1, got ${size}`);

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};
