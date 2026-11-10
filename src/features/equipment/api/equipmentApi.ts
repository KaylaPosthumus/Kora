/**
 * Equipment items, their categories, and assignment to employees.
 */

import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import type { Equipment } from "@/shared/types/equipment";
import {
  ok,
  employeesCol,
  equipmentCol,
  equipmentCategoriesCol,
  getDocsByIds,
  toEquipment,
} from "@/shared/lib/firestore";
import type {
  ApiResponse,
} from "@/shared/lib/firestore";
import { db } from "@/services/firebase";

export const equipmentAPI = {
  /**
   * All equipment, each item paired with the employee holding it. The management
   * table reads `item.equipment.*` alongside the holder's name and picture, so the
   * employees are fetched once and joined in memory rather than per row.
   */
  getAllEquipItems: async (): Promise<ApiResponse<any[]>> => {
    const [equipmentSnapshot, employeesSnapshot] = await Promise.all([
      getDocs(query(equipmentCol, orderBy("equipmentName"))),
      getDocs(employeesCol),
    ]);

    const employees = new Map(employeesSnapshot.docs.map((d) => [d.id, d.data()]));

    // How many items each employee currently holds.
    const itemCounts = new Map<string, number>();
    equipmentSnapshot.docs.forEach((d) => {
      const employeeId = d.data().employeeId;
      if (employeeId) itemCounts.set(employeeId, (itemCounts.get(employeeId) ?? 0) + 1);
    });

    return ok(
      equipmentSnapshot.docs.map((d) => {
        const equipment = toEquipment(d.id, d.data());
        const employee = equipment.employeeId ? employees.get(equipment.employeeId) : undefined;

        return {
          equipment,
          fullName: employee?.fullName ?? null,
          profilePicture: employee?.profilePicture ?? null,
          employDate: employee?.employDate ?? null,
          isSuspended: employee?.isSuspended ?? null,
          numberOfItems: equipment.employeeId
            ? itemCounts.get(equipment.employeeId) ?? 0
            : null,
        };
      })
    );
  },

  getAllUnassignedEquipItems: async (): Promise<ApiResponse<Equipment[]>> => {
    const snapshot = await getDocs(query(equipmentCol, where("employeeId", "==", null)));
    return ok(snapshot.docs.map((d) => toEquipment(d.id, d.data())));
  },

  /**
   * Creates one or many equipment items. The category name is denormalised onto
   * each item so the equipment table doesn't need a category lookup per row.
   */
  createEquipItemOrItems: async (
    data: Record<string, any> | Record<string, any>[]
  ): Promise<ApiResponse<{ ids: string[] }>> => {
    const items = Array.isArray(data) ? data : [data];
    if (items.length === 0) return ok({ ids: [] }, 201);

    const categories = await getDocsByIds(
      "equipmentCategories",
      items.map((item) => item.equipmentCatId)
    );

    const batch = writeBatch(db);
    const ids: string[] = [];

    items.forEach((item) => {
      const ref = doc(equipmentCol);
      ids.push(ref.id);
      batch.set(ref, {
        equipmentName: item.equipmentName,
        equipmentCatId: item.equipmentCatId,
        equipmentCategoryName:
          item.equipmentCategoryName ??
          categories.get(item.equipmentCatId)?.equipmentCatName ??
          "",
        condition: item.condition,
        employeeId: item.employeeId ?? null,
        assignedDate: item.assignedDate ?? null,
        createdAt: serverTimestamp(),
      });
    });

    await batch.commit();
    return ok({ ids }, 201);
  },

  editEquipItemById: async (
    id: string,
    data: Record<string, any>
  ): Promise<ApiResponse<null>> => {
    const update = { ...data };

    // Keep the denormalised category name in step when the category changes.
    if (data.equipmentCatId && !data.equipmentCategoryName) {
      const category = await getDoc(doc(equipmentCategoriesCol, data.equipmentCatId));
      if (category.exists()) update.equipmentCategoryName = category.data().equipmentCatName;
    }

    await updateDoc(doc(equipmentCol, id), update);
    return ok(null);
  },

  assignEquipItemOrItemsToEmp: async (
    empId: string,
    equipIds: string[]
  ): Promise<ApiResponse<null>> => {
    const assignedDate = new Date().toISOString();
    const batch = writeBatch(db);

    equipIds.forEach((equipmentId) =>
      batch.update(doc(equipmentCol, equipmentId), { employeeId: empId, assignedDate })
    );

    await batch.commit();
    return ok(null);
  },

  /**
   * Unlinks an item from its holder. Despite the old DELETE verb this never
   * deleted the item — only the link.
   */
  unlinkEquipItemFromEmp: async (id: string): Promise<ApiResponse<null>> => {
    await updateDoc(doc(equipmentCol, id), { employeeId: null, assignedDate: null });
    return ok(null);
  },

  massUnlinkEquipItemsFromEmp: async (id: string): Promise<ApiResponse<null>> => {
    const snapshot = await getDocs(query(equipmentCol, where("employeeId", "==", id)));

    const batch = writeBatch(db);
    snapshot.docs.forEach((item) =>
      batch.update(item.ref, { employeeId: null, assignedDate: null })
    );

    await batch.commit();
    return ok(null);
  },

  deleteEquipItemById: async (id: string): Promise<ApiResponse<null>> => {
    await deleteDoc(doc(equipmentCol, id));
    return ok(null);
  },

  getAllEquipCategories: async (): Promise<ApiResponse<any[]>> => {
    const snapshot = await getDocs(query(equipmentCategoriesCol, orderBy("equipmentCatName")));
    return ok(
      snapshot.docs.map((d) => ({ equipmentCatId: d.id, ...d.data() }))
    );
  },
};
