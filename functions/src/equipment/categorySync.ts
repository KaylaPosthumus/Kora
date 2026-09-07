/**
 * Keeping `equipment.equipmentCategoryName` in step with its category.
 *
 * Equipment denormalises the category's display name so the admin equipment
 * table renders without a lookup per row — `editEquipItemById` copies it when an
 * individual item is edited. Nothing copies it the other way, so renaming a
 * category in `equipmentCategories` leaves every existing item showing the old
 * name. There is no client path that renames a category at all (`equipmentAPI`
 * exposes only `getAllEquipCategories`), which means a trigger is the only place
 * this can happen.
 *
 * **Deletion is deliberately not cascaded.** Categories are a fixed enum, not
 * free-form data: `seed.mjs` creates them with ids matching `EquipmentCategory`
 * in `src/types/common.ts`, and `EquipmentTypeAvatar` switches on that enum
 * rather than reading the document. So equipment keeps rendering correctly even
 * with the category document gone, and nulling `equipmentCatId` to "clean up"
 * would break the avatar and lose which category the item is. Deleting a
 * category is a schema change; it is logged, not compensated for.
 *
 * Leave types are the opposite case and are handled the opposite way in
 * `leave/leaveTypeSync.ts` — there is no `LeaveType` enum, so they are genuine
 * data and their deletion does cascade.
 */

/** An `equipmentCategories/{categoryId}` document. */
export interface CategoryDoc {
  equipmentCatName?: unknown;
}

/** The display name to mirror, normalised to a storable value. */
export const categoryName = (category: CategoryDoc): string =>
  typeof category.equipmentCatName === "string" ? category.equipmentCatName : "";

/**
 * Whether the mirrored name needs rewriting.
 *
 * A create counts as a change: equipment can reference a category id before the
 * category document exists (the ids are enum values, so the client can write one
 * either way), and that equipment is carrying an empty name until this runs.
 */
export const nameNeedsMirroring = (
  before: CategoryDoc | undefined,
  after: CategoryDoc
): boolean => before === undefined || categoryName(before) !== categoryName(after);

/** The update applied to each affected equipment document. */
export const mirrorNameUpdate = (after: CategoryDoc): Record<string, unknown> => ({
  equipmentCategoryName: categoryName(after),
});
