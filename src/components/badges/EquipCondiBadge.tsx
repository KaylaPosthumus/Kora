import React, { JSX } from "react";
import { EquipmentCondition } from "../../types/common";
import CoriBadge from "./CoriBadge";

interface EquipCondiBadgeProps {
  condition: EquipmentCondition;
  className?: string;
}

function EquipCondiBadge({ condition, className }: EquipCondiBadgeProps) {
  let color: string;
  let text: string;

  switch (condition) {
    case EquipmentCondition.New:
      color = "green";
      text = "New";
      break;
    case EquipmentCondition.Good:
      color = "blue";
      text = "Good";
      break;
    case EquipmentCondition.Decent:
      color = "orange";
      text = "Decent";
      break;
    case EquipmentCondition.Used:
      color = "gray";
      text = "Used";
      break;
    default:
      color = "white";
      text = "Unknown";
      break;
  }

  return (
    <CoriBadge
      text={text}
      color={color as "gray" | "green" | "blue" | "white" | "orange"}
      size="small"
      className={`w-fit ${className}`}
    />
  );
}

export default EquipCondiBadge;
