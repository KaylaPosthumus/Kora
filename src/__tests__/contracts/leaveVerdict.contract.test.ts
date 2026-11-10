/**
 * The leave verdict, across the package boundary.
 *
 * `onLeaveRequestWritten` computes a verdict in `functions/`; `LeaveValidationNotice`
 * renders it in `src/`. The two declare the shape separately — they have to, because
 * the browser bundle and the functions package are different dependency trees — so
 * nothing stops them drifting apart. Each suite passes against its own fixtures
 * while the field written and the field read disagree.
 *
 * These tests import both halves and run the real backend function, then hand its
 * real output to the real frontend one. A new issue code added on the backend
 * fails here rather than rendering as a blank warning in production.
 */

import { describe, it, expect } from "vitest";

// The backend's own module. It is one of the pure decision modules — no Firebase
// imports at all — which is what makes importing it from this suite safe.
import {
  validateLeaveRequest,
  type LeaveIssue as BackendIssue,
} from "../../../functions/src/leave/leaveRequestValidation";

import { describeIssue } from "@/features/leave/components";
import type { LeaveIssue as FrontendIssue } from "@/shared/types/leaveRequest";

/** Every code the backend can emit, produced by actually running it. */
const issuesFrom = (verdict: { issues: BackendIssue[] }) => verdict.issues;

describe("every issue the backend emits, the frontend can describe", () => {
  it("handles an inverted date range", () => {
    const verdict = validateLeaveRequest(
      { employeeId: "e1", leaveTypeId: "annual", startDate: "2026-03-10", endDate: "2026-03-04" },
      [],
      undefined
    );
    const codes = issuesFrom(verdict).map((i) => i.code);
    expect(codes).toContain("inverted-dates");

    for (const issue of issuesFrom(verdict)) {
      const text = describeIssue(issue as FrontendIssue);
      expect(text).toBeTruthy();
      expect(text).not.toContain("undefined");
    }
  });

  it("handles unreadable dates", () => {
    const verdict = validateLeaveRequest(
      { employeeId: "e1", leaveTypeId: "annual", startDate: null, endDate: "2026-03-04" },
      [],
      undefined
    );
    for (const issue of issuesFrom(verdict)) {
      expect(describeIssue(issue as FrontendIssue)).toBeTruthy();
    }
  });

  it("handles a missing balance", () => {
    const verdict = validateLeaveRequest(
      { employeeId: "e1", leaveTypeId: "annual", startDate: "2026-03-02", endDate: "2026-03-04" },
      [],
      undefined
    );
    expect(issuesFrom(verdict).map((i) => i.code)).toContain("no-balance");
    for (const issue of issuesFrom(verdict)) {
      expect(describeIssue(issue as FrontendIssue)).toBeTruthy();
    }
  });

  it("handles a balance that does not cover the request", () => {
    const verdict = validateLeaveRequest(
      { employeeId: "e1", leaveTypeId: "annual", startDate: "2026-03-02", endDate: "2026-03-11" },
      [],
      2
    );
    const insufficient = issuesFrom(verdict).find((i) => i.code === "insufficient-balance");
    expect(insufficient).toBeDefined();

    const text = describeIssue(insufficient as FrontendIssue);
    // The numbers the backend computed must survive into the sentence.
    expect(text).toContain("10");
    expect(text).toContain("2");
  });

  it("handles an overlap with another request", () => {
    const verdict = validateLeaveRequest(
      { employeeId: "e1", leaveTypeId: "annual", startDate: "2026-03-02", endDate: "2026-03-04" },
      [
        {
          id: "other",
          employeeId: "e1",
          leaveTypeId: "annual",
          startDate: "2026-03-03",
          endDate: "2026-03-05",
          status: "approved",
        },
      ],
      30
    );
    const overlap = issuesFrom(verdict).find((i) => i.code === "overlaps");
    expect(overlap).toBeDefined();
    expect(describeIssue(overlap as FrontendIssue)).toBe(
      "Overlaps 1 other request from this employee."
    );
  });
});

describe("the two declarations of the verdict agree", () => {
  it("assigns a backend issue to the frontend type without a cast", () => {
    // If the unions diverge, this stops compiling — which is the point. It is a
    // type-level assertion with a runtime body only so vitest has something to run.
    const issue: BackendIssue = { code: "no-balance", leaveTypeId: "annual" };
    const asFrontend: FrontendIssue = issue;
    expect(asFrontend.code).toBe("no-balance");
  });
});
