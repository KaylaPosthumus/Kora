import React from "react";
import { Icons } from "../../constants/icons";
import { EquipmentCategory } from "../../types/common";

interface EquipmentTypeAvatarProps {
  equipmentCategoryId: EquipmentCategory | string;
  colour?: string;
  className?: string;
}

function EquipmentTypeAvatar({ equipmentCategoryId, className, colour }: EquipmentTypeAvatarProps) {
  let icon;
  let bgColour;
  let iconColour;

  switch (colour) {
    case "green":
      bgColour = "bg-corigreen-100";
      iconColour = "text-corigreen-600";
      break;
    case "red":
      bgColour = "bg-red-100";
      iconColour = "text-red-600";
      break;
    default:
      bgColour = "bg-zinc-100";
      iconColour = "text-zinc-900";
      break;
  }

  switch (equipmentCategoryId) {
    case EquipmentCategory.Cellphone:
      icon = <Icons.Phone fontSize="large" className={iconColour} />;
      break;
    case EquipmentCategory.Tablet:
      icon = <Icons.Tablet fontSize="large" className={iconColour} />;
      break;
    case EquipmentCategory.Laptop:
      icon = <Icons.Laptop fontSize="large" className={iconColour} />;
      break;
    case EquipmentCategory.Monitor:
      icon = <Icons.Monitor fontSize="large" className={iconColour} />;
      break;
    case EquipmentCategory.Headset:
      icon = <Icons.Headset fontSize="large" className={iconColour} />;
      break;
    case EquipmentCategory.Keyboard:
      icon = <Icons.Keyboard fontSize="large" className={iconColour} />;
      break;
    default:
      icon = <Icons.DeviceUnknown fontSize="large" className={iconColour} />;
      break;
  }

  return (
    <div
      className={`${bgColour} rounded-full h-14 w-14 flex items-center justify-center ${className}`}
    >
      {icon}
    </div>
  );
}

export default EquipmentTypeAvatar;
