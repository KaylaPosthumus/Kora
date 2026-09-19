import React from "react";
import { Tooltip } from "antd";
import { Icons } from "@/constants/icons";
import type { LeaveIssue, LeaveVerdict } from "@/shared/types/leaveRequest";

interface LeaveValidationNoticeProps {
  verdict: LeaveVerdict | undefined;
  className?: string;
}

/**
 * The backend's verdict on a leave request, where an admin will see it.
 *
 * `onLeaveRequestWritten` checks two things the client cannot: whether the
 * request overlaps another of the employee's own, and whether their balance
 * covers it. Overlap is the one that matters here — finding it needs a query
 * across the employee's other requests, so no amount of work on the row itself
 * would surface it.
 *
 * Advisory by design. It warns; it never blocks. Over-drawing a balance is a
 * supported flow with its own confirmation, and two overlapping requests may be
 * exactly what the employee meant.
 *
 * Renders nothing when the verdict is absent — every request written before the
 * trigger was deployed has no `validation` field, and a freshly filed one has
 * none until the trigger runs a moment later.
 */
const LeaveValidationNotice: React.FC<LeaveValidationNoticeProps> = ({
  verdict,
  className,
}) => {
  if (!verdict || verdict.issues.length === 0) return null;

  return (
    <Tooltip
      placement="top"
      title={
        <ul className="m-0 pl-4 list-disc">
          {verdict.issues.map((issue, index) => (
            <li key={`${issue.code}-${index}`}>{describeIssue(issue)}</li>
          ))}
        </ul>
      }
    >
      <span
        className={`inline-flex items-center cursor-default ${className ?? ""}`}
        aria-label={`${verdict.issues.length} issue${
          verdict.issues.length === 1 ? "" : "s"
        } with this request`}
      >
        <Icons.Warning className="text-orange-500" style={{ fontSize: 16 }} />
      </span>
    </Tooltip>
  );
};

/** One sentence per issue. Kept beside the component that is the only reader. */
export const describeIssue = (issue: LeaveIssue): string => {
  switch (issue.code) {
    case "overlaps": {
      const count = issue.conflicts.length;
      return `Overlaps ${count} other request${count === 1 ? "" : "s"} from this employee.`;
    }
    case "insufficient-balance":
      return `Asks for ${issue.requestedDays} days but only ${issue.remainingDays} remain.`;
    case "no-balance":
      return "This employee has no balance for this leave type.";
    case "inverted-dates":
      return `The end date (${issue.endDate}) is before the start date (${issue.startDate}).`;
    case "invalid-dates":
      return issue.message;
  }
};

export default LeaveValidationNotice;
