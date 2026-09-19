import React from "react";
import KoraBadge from "@/shared/components/KoraBadge";
import dayjs from "dayjs";
import { isDateInPast } from "@/utils/dateUtils";

interface TimeTodayBadgeProps {
  date: string;
}

function TimeTodayBadge({ date }: TimeTodayBadgeProps) {
  let color: string;

  const isPast = isDateInPast(date);

  if (isPast) {
    color = "red";
  } else {
    color = "green";
  }
  return (
    <KoraBadge
      text={dayjs(date).fromNow()}
      color={color as "red" | "green"}
      size="x-small"
      className="w-fit"
    />
  );
}

export default TimeTodayBadge;
