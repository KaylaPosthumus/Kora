import React from "react";
import { Icons } from "@/constants/icons";
import EquipCondiBadge from "@/features/equipment/components/EquipCondiBadge";
import { EquipmentCondition } from "@/shared/types/common";
import EquipmentTypeAvatar from "@/features/equipment/components/EquipmentTypeAvatar";

interface EquipCheckItemProps {
  equipmentId: string;
  equipmentName: string;
  equipmentCategoryId: string;
  equipmentCategoryName: string;
  condition: EquipmentCondition;
  isSelected: boolean;
  onClick: () => void;
}

const EquipCheckItem: React.FC<EquipCheckItemProps> = ({
  equipmentId,
  equipmentName,
  equipmentCategoryId,
  equipmentCategoryName,
  condition,
  isSelected,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl w-full cursor-pointer ${
        isSelected ? "bg-corigreen-100" : "bg-transparent"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10">
          {isSelected ? (
            <div className="bg-corigreen-500 rounded-full flex items-center justify-center h-8 w-8">
              <Icons.Check className="text-white" />
            </div>
          ) : (
            <div className="bg-warmstone-500 rounded-full flex items-center justify-center h-10 w-10">
              <EquipmentTypeAvatar equipmentCategoryId={equipmentCategoryId} />
            </div>
          )}
        </div>
        <div className="flex flex-col select-none">
          <span className="text-zinc-900">{equipmentName}</span>
          <span className="text-zinc-500 text-sm">{equipmentCategoryName}</span>
        </div>
      </div>
      <EquipCondiBadge condition={condition} className="select-none" />
    </div>
  );
};

export default EquipCheckItem;
