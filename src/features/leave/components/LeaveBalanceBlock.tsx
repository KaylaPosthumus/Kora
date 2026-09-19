import React, { useState } from "react";

// Import icons
import BeachAccessIcon from "@mui/icons-material/BeachAccess";
import SickIcon from "@mui/icons-material/Sick";
import ChildFriendlyIcon from "@mui/icons-material/ChildFriendly";
import FamilyRestroomIcon from "@mui/icons-material/FamilyRestroom";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import HeartBrokenIcon from "@mui/icons-material/HeartBroken";
import { Tooltip } from "antd";

interface LeaveBalanceBlockProps {
  leaveType: string;
  remainingDays: number;
  totalDays: number;
  description: string;
  className?: string;
}

function LeaveBalanceBlock({
  leaveType,
  remainingDays,
  totalDays,
  description,
  className,
}: LeaveBalanceBlockProps) {
  const [isHovered, setIsHovered] = useState(false);

  const isEmpty = remainingDays === 0;

  const getLeaveIcon = () => {
    switch (leaveType) {
      case "Annual":
        return (
          <BeachAccessIcon
            style={{
              fontSize: isHovered ? "0px" : "24px",
              transition: "font-size 0.3s ease",
            }}
          />
        );
      case "Sick":
        return (
          <SickIcon
            style={{
              fontSize: isHovered ? "0px" : "24px",
              transition: "font-size 0.3s ease",
            }}
          />
        );
      case "Parental":
        return (
          <ChildFriendlyIcon
            style={{
              fontSize: isHovered ? "0px" : "24px",
              transition: "font-size 0.3s ease",
            }}
          />
        );
      case "Family Responsibility":
        return (
          <FamilyRestroomIcon
            style={{
              fontSize: isHovered ? "0px" : "24px",
              transition: "font-size 0.3s ease",
            }}
          />
        );
      case "Study":
        return (
          <MenuBookIcon
            style={{
              fontSize: isHovered ? "0px" : "24px",
              transition: "font-size 0.3s ease",
            }}
          />
        );
      case "Compassionate":
        return (
          <HeartBrokenIcon
            style={{
              fontSize: isHovered ? "0px" : "24px",
              transition: "font-size 0.3s ease",
            }}
          />
        );
      default:
        return (
          <BeachAccessIcon
            style={{
              fontSize: isHovered ? "0px" : "24px",
              transition: "font-size 0.3s ease",
            }}
          />
        );
    }
  };

  return (
    <Tooltip placement="right" title={description}>
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`bg-warmstone-50 p-3 rounded-2xl flex flex-col items-center justify-center text-center h-32 shadow-sm border-2 border-warmstone-50 hover:bg-sakura-200 hover:border-sakura-500 transition-all duration-300 group cursor-default select-none ${className}`}
      >
        <div className="flex items-center gap-1">
          {isEmpty ? (
            <>
              <p
                className={`text-red-800 font-bold text-2xl group-hover:text-4xl transition-all duration-300`}
              >
                {isHovered ? 0 : "No"}
              </p>
            </>
          ) : (
            <>
              {getLeaveIcon()}
              <p
                className={`text-zinc-900 font-bold text-2xl group-hover:text-4xl transition-all duration-300`}
              >
                {remainingDays}
              </p>
            </>
          )}
        </div>
        <p className="text-zinc-900 font-semibold text-[0px] group-hover:text-[12px] transition-all duration-300">
          out of {totalDays} days
        </p>
        <p className="text-zinc-500 text-[12px]">
          {leaveType === "Family Responsibility"
            ? "Family"
            : leaveType === "Compassionate"
            ? "Grief"
            : leaveType}{" "}
          {isHovered ? "Leave" : `${totalDays === 1 ? "Day" : "Days"}`}
        </p>
      </div>
    </Tooltip>
  );
}

export default LeaveBalanceBlock;
