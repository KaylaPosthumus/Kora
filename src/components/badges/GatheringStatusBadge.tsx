import React from "react";
import { MeetStatus } from "@/shared/types/common";
import KoraBadge from "./KoraBadge";

interface GatheringStatusBadgeProps {
  status: MeetStatus | string;
  className?: string;
}

function GatheringStatusBadge({ status, className }: GatheringStatusBadgeProps) {
  let color: string;
  let text: string;

  switch (status) {
    case MeetStatus.Requested:
      color = "black";
      text = "Pending";
      break;
    case MeetStatus.Upcoming:
      color = "orange";
      text = "In Person";
      break;
    case MeetStatus.Rejected:
      color = "red";
      text = "Rejected";
      break;
    case MeetStatus.Completed:
      color = "green";
      text = "Completed";
      break;
    case "Online":
      color = "blue";
      text = "Online";
      break;
    default:
      color = "white";
      text = "Unknown";
      break;
  }

  return (
    <KoraBadge
      text={text}
      color={color as "red" | "green" | "orange" | "blue" | "black" | "white"}
      size="small"
      className={`w-fit min-w-fit text-nowrap ${className}`}
    />
  );
}

export default GatheringStatusBadge;
