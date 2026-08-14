import { EquipmentCondition } from "../../types/common";

// In Backend: EquipmentDTO

export interface Equipment {
  equipmentId: string;
  employeeId: string | null;
  equipmentCatId: string;
  equipmentCategoryName: string;
  equipmentName: string;
  assignedDate: string | null;
  condition: EquipmentCondition;
}
