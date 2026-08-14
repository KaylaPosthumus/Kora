import React, { useState, JSX } from "react";

// Import Components
import CoriCircleBtn from "../buttons/CoriCircleBtn";
import EquipCondiBadge from "../badges/EquipCondiBadge";

// Functions
import dayjs from "dayjs";

// Import Icons
import { Icons } from "../../constants/icons";

// Types
import { EquipmentCondition, EquipmentCategory } from "../../types/common";
import { Equipment } from "../../interfaces/equipment/equipment";

interface EquipAssignListItemProps {
  item: Equipment | null;
  adminView?: boolean;
  onEdit?: () => void;
  onUnlink?: () => void;
  onDelete?: () => void;
}

function EquipAssignListItem({
  item,
  adminView,
  onEdit,
  onUnlink,
  onDelete,
}: EquipAssignListItemProps) {
  let deviceIcon: JSX.Element;

  // If no item, return null
  if (!item) {
    return null;
  }

  switch (item.equipmentCatId) {
    case EquipmentCategory.Cellphone:
      deviceIcon = <Icons.Phone fontSize="large" data-testid="phone-icon" />;
      break;
    case EquipmentCategory.Tablet:
      deviceIcon = <Icons.Tablet fontSize="large" data-testid="tablet-icon" />;
      break;
    case EquipmentCategory.Laptop:
      deviceIcon = <Icons.Laptop fontSize="large" data-testid="laptop-icon" />;
      break;
    case EquipmentCategory.Monitor:
      deviceIcon = <Icons.Monitor fontSize="large" data-testid="monitor-icon" />;
      break;
    case EquipmentCategory.Headset:
      deviceIcon = <Icons.Headset fontSize="large" data-testid="headset-icon" />;
      break;
    case EquipmentCategory.Keyboard:
      deviceIcon = <Icons.Keyboard fontSize="large" data-testid="keyboard-icon" />;
      break;
    default:
      deviceIcon = <Icons.DeviceUnknown fontSize="large" data-testid="unknown-device-icon" />;
      break;
  }

  return (
    <>
      <div className="flex items-center gap-2 w-full justify-between group">
        <div className="flex items-center gap-2 w-full">
          {deviceIcon}
          <div className="flex flex-col">
            <p className="text-zinc-900">{item.equipmentName}</p>
            <p className="text-zinc-500 text-sm">{item.equipmentCategoryName}</p>
          </div>
        </div>
        <p
          className={`text-zinc-500 text-sm w-4/12 text-center ${
            adminView && "group-hover:opacity-0"
          }`}
        ></p>
        <div className="flex items-center justify-end gap-2 w-2/12">
          <EquipCondiBadge condition={item.condition} />
          {/* Edit button only for admins */}
          {adminView && (
            <>
              <CoriCircleBtn
                style="red"
                icon={<Icons.Delete />}
                onClick={onDelete}
                className="hidden group-hover:flex transition-all duration-300"
                aria-label="delete"
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default EquipAssignListItem;
