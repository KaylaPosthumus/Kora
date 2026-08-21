import React from "react";
import dayjs from "dayjs";

// Icons
import { Icons } from "../../../constants/icons";

// Badges
import KoraBadge from "../../../components/badges/KoraBadge";
import { LeaveStatus, LeaveStatusLabels } from "../../../types/common";

const getStatusBadgeColor = (status: string) => {
  if (status === "Pending") return "yellow";
  if (status === "Rejected") return "red";
  return "green";
};

// Icon rendering function
const getLeaveIcon = (type: string) => {
  if (type.toLowerCase().includes("annual")) return <Icons.BeachAccess fontSize="large" />;
  if (type.toLowerCase().includes("family")) return <Icons.FamilyRestroom fontSize="large" />;
  if (type.toLowerCase().includes("sick")) return <Icons.Sick fontSize="large" />;
  if (type.toLowerCase().includes("compassion")) return <Icons.HeartBroken fontSize="large" />;
  if (type.toLowerCase().includes("study")) return <Icons.MenuBook fontSize="large" />;
  if (type.toLowerCase().includes("parental")) return <Icons.ChildFriendly fontSize="large" />;
  return null;
};

interface LeaveRequest {
  $id: string;
  leaveRequestId: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  comment: string;
  status: LeaveStatus;
  createdAt: string;
  leaveTypeName: string;
  description: string;
  defaultDays: number;
}

interface LeaveRequestCardProps {
  req: LeaveRequest;
}

function LeaveRequestCard({ req }: LeaveRequestCardProps) {
  // calculate actual duration (inclusive of both start and end)
  const start = dayjs(req.startDate);
  const end = dayjs(req.endDate);
  const duration = end.diff(start, "day") + 1;

  return (
    <div
      key={req.$id}
      className="bg-white rounded-2xl p-4 shadow-sm h-48 flex flex-col overflow-hidden"
    >
      {/* Top row: Icon, leave type/days, and status badge */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {getLeaveIcon(req.leaveTypeName)}
          <div>
            <p className="font-semibold text-zinc-900">{req.leaveTypeName} Leave</p>
            <p className="text-sm text-zinc-600">{duration} days</p>
          </div>
        </div>
        <KoraBadge
          text={LeaveStatusLabels[req.status]}
          size="x-small"
          color={getStatusBadgeColor(LeaveStatusLabels[req.status])}
        />
      </div>
      {/* Bottom section: Dates and comment */}
      <div>
        <p className="text-sm text-zinc-800 mt-3">{`${dayjs(req.startDate).format(
          "DD MMM YYYY"
        )} • ${dayjs(req.endDate).format("DD MMM YYYY")}`}</p>
        <p className="text-sm text-zinc-500 mt-2">{req.comment}</p>
      </div>
    </div>
  );
}

export default LeaveRequestCard;
