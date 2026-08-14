import React, { JSX } from "react";
import { EmployType } from "../../types/common";
import CoriBadge from "./CoriBadge";

interface EmployTypeBadgeProps {
  status: EmployType | "suspended";
}

function EmployTypeBadge({ status }: EmployTypeBadgeProps) {
  let component: JSX.Element;
  let color: string;
  let text: string;

  switch (status) {
    case "suspended":
      color = "red";
      text = "Suspended";
      break;
    case EmployType.FullTime:
      color = "green";
      text = "Full Time";
      break;
    case EmployType.PartTime:
      color = "orange";
      text = "Part Time";
      break;
    case EmployType.Contract:
      color = "blue";
      text = "Contract";
      break;
    case EmployType.Intern:
      color = "yellow";
      text = "Intern";
      break;
    default:
      color = "white";
      text = "Unknown";
      break;
  }

  return (
    <CoriBadge
      text={text}
      color={color as "red" | "green" | "orange" | "blue" | "yellow" | "white"}
      size="small"
      className="w-fit min-w-fit text-nowrap"
    />
  );
}

export default EmployTypeBadge;
