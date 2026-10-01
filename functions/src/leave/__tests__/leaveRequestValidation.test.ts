import { describe, it, expect } from "vitest";

import {
  durationInDays,
  rangesOverlap,
  toEpochDay,
  validateLeaveRequest,
  verdictsEqual,
  type LeaveIssue,
  type OtherRequest,
} from "../leaveRequestValidation";

const request = (overrides: Record<string, unknown> = {}) => ({
  employeeId: "emp1",
  leaveTypeId: "annual",
  startDate: "2026-03-02",
  endDate: "2026-03-06",
  status: "pending",
  ...overrides,
});

const codes = (issues: LeaveIssue[]) => issues.map((issue) => issue.code).sort();

describe("toEpochDay", () => {
  it("reads a plain date", () => {
    expect(toEpochDay("1970-01-01")).toBe(0);
    expect(toEpochDay("1970-01-02")).toBe(1);
  });

  it("reads the date part of a full ISO timestamp", () => {
    expect(toEpochDay("2026-03-02T14:30:00.000Z")).toBe(toEpochDay("2026-03-02"));
  });

  // The time component must not shift the day, or a request created late in the
  // evening would count as starting the next day.
  it("ignores the time of day entirely", () => {
    expect(toEpochDay("2026-03-02T23:59:59Z")).toBe(toEpochDay("2026-03-02T00:00:00Z"));
  });

  it.each([
    ["a non-string", 20260302],
    ["an empty string", ""],
    ["a malformed date", "02/03/2026"],
    ["a month that does not exist", "2026-13-01"],
    ["a day that does not exist", "2026-02-30"],
    ["null", null],
    ["undefined", undefined],
  ])("rejects %s", (_label, value) => {
    expect(toEpochDay(value)).toBeNull();
  });

  it("accepts a real leap day", () => {
    expect(toEpochDay("2028-02-29")).not.toBeNull();
  });

  it("rejects a leap day in a non-leap year", () => {
    expect(toEpochDay("2027-02-29")).toBeNull();
  });
});

describe("durationInDays", () => {
  // Inclusive, matching calculateDurationInDays in the app.
  it("counts a single-day request as one day", () => {
    expect(durationInDays("2026-03-02", "2026-03-02")).toBe(1);
  });

  it("counts an inclusive range", () => {
    expect(durationInDays("2026-03-02", "2026-03-06")).toBe(5);
  });

  it("spans a month boundary", () => {
    expect(durationInDays("2026-03-30", "2026-04-02")).toBe(4);
  });

  // The app parses to local midnight; a DST transition can make a truncating
  // diff land one out. Whole UTC days are immune.
  it("is unaffected by a DST transition", () => {
    // 29 March 2026 is the European spring-forward.
    expect(durationInDays("2026-03-28", "2026-03-30")).toBe(3);
  });

  it("returns a negative count for an inverted range", () => {
    expect(durationInDays("2026-03-06", "2026-03-02")).toBe(-3);
  });

  it("returns null when a date cannot be read", () => {
    expect(durationInDays("nonsense", "2026-03-02")).toBeNull();
  });
});

describe("rangesOverlap", () => {
  it.each([
    ["identical ranges", 10, 15, 10, 15, true],
    ["one inside the other", 10, 20, 12, 14, true],
    ["partial overlap at the end", 10, 15, 14, 20, true],
    ["partial overlap at the start", 10, 15, 5, 11, true],
    ["touching on a single shared day", 10, 15, 15, 20, true],
    ["adjacent but not touching", 10, 15, 16, 20, false],
    ["entirely before", 10, 15, 1, 5, false],
    ["entirely after", 10, 15, 30, 35, false],
  ])("%s", (_label, aStart, aEnd, bStart, bEnd, expected) => {
    expect(rangesOverlap(aStart, aEnd, bStart, bEnd)).toBe(expected);
  });
});

describe("validateLeaveRequest", () => {
  it("passes a clean request", () => {
    const verdict = validateLeaveRequest(request(), [], 20);

    expect(verdict).toEqual({ valid: true, issues: [], days: 5 });
  });

  // The bug that matters: setLeaveRequestStatus computes delta = -days, so a
  // negative duration adds days to the balance on approval.
  it("flags an inverted range, which would inflate the balance on approval", () => {
    const verdict = validateLeaveRequest(
      request({ startDate: "2026-03-06", endDate: "2026-03-02" }),
      [],
      20
    );

    expect(verdict.valid).toBe(false);
    expect(codes(verdict.issues)).toContain("inverted-dates");
    expect(verdict.days).toBe(-3);
  });

  it("reports unreadable dates and stops there", () => {
    const verdict = validateLeaveRequest(request({ startDate: "nope" }), [], 20);

    expect(verdict.valid).toBe(false);
    expect(codes(verdict.issues)).toEqual(["invalid-dates"]);
    expect(verdict.days).toBeNull();
  });

  describe("overlap", () => {
    const other = (overrides: Partial<OtherRequest> = {}): OtherRequest => ({
      id: "lr-other",
      employeeId: "emp1",
      leaveTypeId: "annual",
      startDate: "2026-03-04",
      endDate: "2026-03-08",
      status: "approved",
      ...overrides,
    });

    it("flags an overlapping approved request", () => {
      const verdict = validateLeaveRequest(request(), [other()], 20);

      expect(codes(verdict.issues)).toContain("overlaps");
      expect(verdict.issues).toContainEqual({
        code: "overlaps",
        conflicts: [{ id: "lr-other", status: "approved" }],
      });
    });

    it("flags an overlapping pending request too", () => {
      const verdict = validateLeaveRequest(request(), [other({ status: "pending" })], 20);

      expect(codes(verdict.issues)).toContain("overlaps");
    });

    // A rejected request booked nothing off and debited nothing.
    it("ignores a rejected request", () => {
      const verdict = validateLeaveRequest(request(), [other({ status: "rejected" })], 20);

      expect(verdict.valid).toBe(true);
    });

    it("ignores a request that does not overlap", () => {
      const verdict = validateLeaveRequest(
        request(),
        [other({ startDate: "2026-04-01", endDate: "2026-04-03" })],
        20
      );

      expect(verdict.valid).toBe(true);
    });

    it("flags a single shared day", () => {
      const verdict = validateLeaveRequest(
        request(),
        [other({ startDate: "2026-03-06", endDate: "2026-03-10" })],
        20
      );

      expect(codes(verdict.issues)).toContain("overlaps");
    });

    it("lists every conflicting request", () => {
      const verdict = validateLeaveRequest(
        request(),
        [other({ id: "a" }), other({ id: "b", status: "pending" })],
        20
      );

      expect(verdict.issues).toContainEqual({
        code: "overlaps",
        conflicts: [
          { id: "a", status: "approved" },
          { id: "b", status: "pending" },
        ],
      });
    });

    it("ignores another request whose dates are unreadable", () => {
      const verdict = validateLeaveRequest(request(), [other({ startDate: "x" })], 20);

      expect(verdict.valid).toBe(true);
    });
  });

  describe("balance", () => {
    it("flags a request longer than the remaining balance", () => {
      const verdict = validateLeaveRequest(request(), [], 3);

      expect(verdict.issues).toContainEqual({
        code: "insufficient-balance",
        requestedDays: 5,
        remainingDays: 3,
      });
    });

    it("allows a request that exactly spends the balance", () => {
      expect(validateLeaveRequest(request(), [], 5).valid).toBe(true);
    });

    // Without a balance document setLeaveRequestStatus skips the decrement, so
    // the days would be approved and never deducted.
    it("flags a missing balance document", () => {
      const verdict = validateLeaveRequest(request(), [], undefined);

      expect(verdict.issues).toContainEqual({
        code: "no-balance",
        leaveTypeId: "annual",
      });
    });

    it("flags an already-negative balance", () => {
      const verdict = validateLeaveRequest(request(), [], -2);

      expect(codes(verdict.issues)).toContain("insufficient-balance");
    });

    // The inverted-date issue is the real finding; a negative duration must not
    // also produce a nonsensical balance complaint.
    it("does not add a balance complaint for an inverted range", () => {
      const verdict = validateLeaveRequest(
        request({ startDate: "2026-03-06", endDate: "2026-03-02" }),
        [],
        20
      );

      expect(codes(verdict.issues)).toEqual(["inverted-dates"]);
    });
  });

  it("reports several independent problems at once", () => {
    const verdict = validateLeaveRequest(
      request(),
      [
        {
          id: "lr-other",
          startDate: "2026-03-04",
          endDate: "2026-03-08",
          status: "approved",
        },
      ],
      1
    );

    expect(codes(verdict.issues)).toEqual(["insufficient-balance", "overlaps"]);
  });
});

describe("verdictsEqual", () => {
  const verdict = () => validateLeaveRequest(request(), [], 20);

  it("treats an identical verdict as unchanged", () => {
    expect(verdictsEqual(verdict(), verdict())).toBe(true);
  });

  it("treats a missing previous verdict as changed", () => {
    expect(verdictsEqual(undefined, verdict())).toBe(false);
  });

  it("spots a changed verdict", () => {
    expect(verdictsEqual(verdict(), validateLeaveRequest(request(), [], 1))).toBe(false);
  });
});
