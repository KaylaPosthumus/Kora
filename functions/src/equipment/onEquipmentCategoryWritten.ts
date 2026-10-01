/**
 * `onEquipmentCategoryWritten` — mirrors a category's display name onto the
 * equipment that denormalises it.
 *
 * See `categorySync.ts` for why a deletion is logged rather than cascaded.
 */

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";

import { mirrorNameUpdate, nameNeedsMirroring, type CategoryDoc } from "./categorySync";
import { chunk } from "../shared/chunk";
import { db } from "../shared/admin";

export const onEquipmentCategoryWritten = onDocumentWritten(
  "equipmentCategories/{categoryId}",
  async (event) => {
    const categoryId = event.params.categoryId;

    const before = event.data?.before.exists
      ? (event.data.before.data() as CategoryDoc)
      : undefined;
    const after = event.data?.after.exists
      ? (event.data.after.data() as CategoryDoc)
      : undefined;

    if (after === undefined) {
      // Categories are a fixed enum whose ids the frontend resolves without
      // reading these documents, so equipment keeps rendering. Nulling
      // equipmentCatId here would break the avatar and lose the category.
      logger.warn(
        "onEquipmentCategoryWritten: a category document was deleted; equipment " +
          "referencing it is intentionally left untouched",
        { categoryId }
      );
      return;
    }

    if (!nameNeedsMirroring(before, after)) return;

    // A single equality filter, so the automatic single-field index covers it.
    const snapshot = await db()
      .collection("equipment")
      .where("equipmentCatId", "==", categoryId)
      .select()
      .get();

    const ids = snapshot.docs.map((doc) => doc.id);
    if (ids.length === 0) return;

    const update = mirrorNameUpdate(after);
    for (const batch of chunk(ids)) {
      const write = db().batch();
      batch.forEach((id) =>
        // merge rather than update: an item deleted since the read above would
        // otherwise reject the whole batch.
        write.set(db().collection("equipment").doc(id), update, { merge: true })
      );
      await write.commit();
    }

    logger.info("onEquipmentCategoryWritten: category name mirrored", {
      categoryId,
      equipmentUpdated: ids.length,
    });
  }
);
