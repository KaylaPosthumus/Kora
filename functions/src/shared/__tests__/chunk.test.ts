import { describe, it, expect } from "vitest";

import { chunk, MAX_BATCH_OPERATIONS } from "../chunk";

describe("chunk", () => {
  it("yields no chunks for an empty list, so a caller can commit unconditionally", () => {
    expect(chunk([])).toEqual([]);
  });

  it("keeps a list shorter than the size in one chunk", () => {
    expect(chunk([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  });

  it("splits on the boundary without emitting an empty trailing chunk", () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("puts the remainder in a shorter final chunk", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  // The case that matters: a cascade over more documents than one batch holds.
  it("splits at Firestore's 500-operation batch cap by default", () => {
    const ids = Array.from({ length: 1001 }, (_, index) => index);
    const chunks = chunk(ids);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(MAX_BATCH_OPERATIONS);
    expect(chunks[1]).toHaveLength(MAX_BATCH_OPERATIONS);
    expect(chunks[2]).toHaveLength(1);
    expect(chunks.flat()).toEqual(ids);
  });

  it("never exceeds the requested size", () => {
    const ids = Array.from({ length: 97 }, (_, index) => index);
    expect(chunk(ids, 10).every((part) => part.length <= 10)).toBe(true);
  });

  it("preserves order and loses nothing", () => {
    const ids = Array.from({ length: 55 }, (_, index) => `id-${index}`);
    expect(chunk(ids, 7).flat()).toEqual(ids);
  });

  // A size of 0 would loop forever rather than fail, which is the worst
  // possible outcome inside a Cloud Function.
  it("rejects a size below 1 instead of looping forever", () => {
    expect(() => chunk([1, 2], 0)).toThrow(RangeError);
    expect(() => chunk([1, 2], -1)).toThrow(RangeError);
  });
});
