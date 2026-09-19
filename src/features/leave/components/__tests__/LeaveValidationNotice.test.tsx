/**
 * The backend's leave verdict, as an admin sees it.
 *
 * The behaviour worth pinning is what happens when there is no verdict: every
 * request written before onLeaveRequestWritten was deployed has no `validation`
 * field, and a freshly filed one has none for the moment before the trigger
 * runs. Rendering a warning in either case would be wrong.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LeaveValidationNotice, {
  describeIssue,
} from "@/features/leave/components/LeaveValidationNotice";
import type { LeaveVerdict } from "@/shared/types/leaveRequest";

const verdict = (issues: LeaveVerdict["issues"]): LeaveVerdict => ({
  valid: issues.length === 0,
  issues,
  days: 3,
});

describe("when there is nothing to warn about", () => {
  it("renders nothing for a request the trigger has not reached yet", () => {
    const { container } = render(<LeaveValidationNotice verdict={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for a clean verdict", () => {
    const { container } = render(<LeaveValidationNotice verdict={verdict([])} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("when the backend found problems", () => {
  it("shows a warning naming how many there are", () => {
    render(
      <LeaveValidationNotice
        verdict={verdict([
          { code: "overlaps", conflicts: [{ id: "r2", status: "approved" }] },
          { code: "no-balance", leaveTypeId: "annual" },
        ])}
      />
    );
    expect(screen.getByLabelText("2 issues with this request")).toBeInTheDocument();
  });

  it("uses the singular for one issue", () => {
    render(
      <LeaveValidationNotice
        verdict={verdict([{ code: "no-balance", leaveTypeId: "annual" }])}
      />
    );
    expect(screen.getByLabelText("1 issue with this request")).toBeInTheDocument();
  });
});

describe("describing an issue", () => {
  it("counts overlapping requests, singular and plural", () => {
    expect(
      describeIssue({ code: "overlaps", conflicts: [{ id: "a", status: "pending" }] })
    ).toBe("Overlaps 1 other request from this employee.");
    expect(
      describeIssue({
        code: "overlaps",
        conflicts: [
          { id: "a", status: "pending" },
          { id: "b", status: "approved" },
        ],
      })
    ).toBe("Overlaps 2 other requests from this employee.");
  });

  it("contrasts the days asked for with the days left", () => {
    expect(
      describeIssue({ code: "insufficient-balance", requestedDays: 5, remainingDays: 2 })
    ).toBe("Asks for 5 days but only 2 remain.");
  });

  it("names both dates when the range is inverted", () => {
    expect(
      describeIssue({ code: "inverted-dates", startDate: "2026-03-10", endDate: "2026-03-04" })
    ).toContain("2026-03-04");
  });

  it("passes an invalid-dates message through unchanged", () => {
    expect(describeIssue({ code: "invalid-dates", message: "startDate is missing." })).toBe(
      "startDate is missing."
    );
  });
});
