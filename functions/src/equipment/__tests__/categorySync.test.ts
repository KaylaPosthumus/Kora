import { describe, it, expect } from "vitest";

import { categoryName, mirrorNameUpdate, nameNeedsMirroring } from "../categorySync";

describe("categoryName", () => {
  it("reads the display name", () => {
    expect(categoryName({ equipmentCatName: "Laptop" })).toBe("Laptop");
  });

  it.each([
    ["a missing name", {}],
    ["a null name", { equipmentCatName: null }],
    ["a non-string name", { equipmentCatName: 7 }],
  ])("falls back to an empty string for %s", (_label, category) => {
    expect(categoryName(category)).toBe("");
  });
});

describe("nameNeedsMirroring", () => {
  it("is true for a rename", () => {
    expect(
      nameNeedsMirroring({ equipmentCatName: "Laptop" }, { equipmentCatName: "Notebook" })
    ).toBe(true);
  });

  it("is false when the name is unchanged", () => {
    expect(
      nameNeedsMirroring({ equipmentCatName: "Laptop" }, { equipmentCatName: "Laptop" })
    ).toBe(false);
  });

  it("ignores changes to fields equipment does not copy", () => {
    expect(
      nameNeedsMirroring(
        { equipmentCatName: "Laptop", icon: "old" } as Record<string, unknown>,
        { equipmentCatName: "Laptop", icon: "new" } as Record<string, unknown>
      )
    ).toBe(false);
  });

  // Equipment can reference a category id before the document exists — the ids
  // are enum values — and that equipment carries an empty name until this runs.
  it("is true on create, to backfill equipment written first", () => {
    expect(nameNeedsMirroring(undefined, { equipmentCatName: "Laptop" })).toBe(true);
  });
});

describe("mirrorNameUpdate", () => {
  it("writes only the denormalised name", () => {
    expect(mirrorNameUpdate({ equipmentCatName: "Notebook" })).toEqual({
      equipmentCategoryName: "Notebook",
    });
  });

  // Rewriting equipmentCatId would be noise at best, and a chance to contradict
  // the enum value the avatar switches on at worst.
  it("never rewrites the category id", () => {
    expect(mirrorNameUpdate({ equipmentCatName: "Notebook" })).not.toHaveProperty(
      "equipmentCatId"
    );
  });
});
