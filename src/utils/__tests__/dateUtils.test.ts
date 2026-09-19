import { describe, it, expect, vi, afterEach } from "vitest";
import { PayCycle } from "@/shared/types/common";
import {
  calculateDurationInDays,
  calculateNextPayDay,
  calculatePreviousPayDay,
  combineDateTimeToTimestamp,
  formatEmploymentDuration,
  formatTimestampToDate,
  formatTimestampToTime,
  isDateInPast,
} from "../dateUtils";

/**
 * Unit tests for the date helpers.
 *
 * `calculateDurationInDays` is the one with teeth: `setLeaveRequestStatus` calls
 * it to work out how many days to take off a leave balance, so an off-by-one
 * here is an off-by-one in everybody's leave. The rest are display helpers, but
 * the pay-day maths drives a real "next payment" figure on the admin screens.
 *
 * The suite runs with TZ=UTC (set in vite.config.ts) because dayjs parses and
 * formats in the local zone — without that, half of these assertions would pass
 * in Johannesburg and fail on CI.
 */

afterEach(() => {
  vi.useRealTimers();
});

describe("calculateDurationInDays", () => {
  it("counts both end dates — a request for one day is one day, not zero", () => {
    expect(calculateDurationInDays("2026-03-02", "2026-03-02")).toBe(1);
  });

  it("counts a Monday-to-Wednesday request as three days", () => {
    // The number the leave transaction subtracts from the balance.
    expect(calculateDurationInDays("2026-03-02", "2026-03-04")).toBe(3);
  });

  it("counts across a month boundary", () => {
    expect(calculateDurationInDays("2026-01-30", "2026-02-02")).toBe(4);
  });

  it("counts across a leap day", () => {
    // 2028 is a leap year: 28 Feb, 29 Feb, 1 Mar.
    expect(calculateDurationInDays("2028-02-28", "2028-03-01")).toBe(3);
  });

  it("does not count weekends or public holidays separately", () => {
    // Calendar days, not working days. Worth pinning: it is a plausible
    // misreading of "duration" and the balance maths depends on which it is.
    expect(calculateDurationInDays("2026-03-06", "2026-03-09")).toBe(4);
  });
});

describe("calculateNextPayDay", () => {
  it("adds a month for a monthly cycle", () => {
    expect(calculateNextPayDay(PayCycle.Monthly, "2026-01-15")).toBe("15 Feb 2026");
  });

  it("clamps to the last day when the next month is shorter", () => {
    expect(calculateNextPayDay(PayCycle.Monthly, "2026-01-31")).toBe("28 Feb 2026");
  });

  it("adds two weeks for a bi-weekly cycle", () => {
    expect(calculateNextPayDay(PayCycle.BiWeekly, "2026-01-15")).toBe("29 Jan 2026");
  });

  it("adds a week for a weekly cycle", () => {
    expect(calculateNextPayDay(PayCycle.Weekly, "2026-01-15")).toBe("22 Jan 2026");
  });

  it("returns the invalid-cycle string rather than a date for an unknown cycle", () => {
    expect(calculateNextPayDay("fortnightly" as PayCycle, "2026-01-15")).toBe(
      "Invalid Pay Cycle"
    );
  });
});

describe("calculatePreviousPayDay", () => {
  it("undoes each cycle", () => {
    expect(calculatePreviousPayDay(PayCycle.Monthly, "2026-02-15")).toBe("15 Jan 2026");
    expect(calculatePreviousPayDay(PayCycle.BiWeekly, "2026-01-29")).toBe("15 Jan 2026");
    expect(calculatePreviousPayDay(PayCycle.Weekly, "2026-01-22")).toBe("15 Jan 2026");
  });

  it("round-trips with calculateNextPayDay for a mid-month date", () => {
    // Undo-payment relies on this: the admin can step back to exactly where
    // they were. It does not hold at a month end, which the clamp test above
    // shows — 31 Jan forward is 28 Feb, and back from there is 28 Jan.
    const next = calculateNextPayDay(PayCycle.Monthly, "2026-01-15");
    expect(calculatePreviousPayDay(PayCycle.Monthly, "2026-02-15")).toBe("15 Jan 2026");
    expect(next).toBe("15 Feb 2026");
  });
});

describe("formatTimestampToDate / formatTimestampToTime", () => {
  it("formats a date-only string for display", () => {
    expect(formatTimestampToDate("2026-04-01")).toBe("01 Apr 2026");
  });

  it("pads a single-digit day", () => {
    expect(formatTimestampToDate("2026-12-05")).toBe("05 Dec 2026");
  });

  it("formats a time as 24-hour with a leading zero", () => {
    expect(formatTimestampToTime("2026-04-01T09:05:00")).toBe("09:05");
  });
});

describe("combineDateTimeToTimestamp", () => {
  it("round-trips back through the time formatter", () => {
    // The meeting form splits date and time and the API stores one timestamp.
    // Asserting the ISO string directly would only hold in one timezone.
    const timestamp = combineDateTimeToTimestamp("2026-03-02", "14:30");
    expect(formatTimestampToTime(timestamp)).toBe("14:30");
    expect(formatTimestampToDate(timestamp)).toBe("02 Mar 2026");
  });

  it("handles midnight without rolling to the previous day", () => {
    const timestamp = combineDateTimeToTimestamp("2026-03-02", "00:00");
    expect(formatTimestampToDate(timestamp)).toBe("02 Mar 2026");
    expect(formatTimestampToTime(timestamp)).toBe("00:00");
  });

  it("produces a parseable ISO string", () => {
    expect(Number.isNaN(Date.parse(combineDateTimeToTimestamp("2026-03-02", "14:30")))).toBe(
      false
    );
  });
});

describe("isDateInPast", () => {
  it("is true for yesterday and false for tomorrow", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));

    expect(isDateInPast("2026-06-14")).toBe(true);
    expect(isDateInPast("2026-06-16")).toBe(false);
  });

  it("treats today as past, because a date-only string parses as midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));

    // Not a bug, but the reason a meeting scheduled for later today still shows
    // as past on the date-only screens.
    expect(isDateInPast("2026-06-15")).toBe(true);
  });
});

describe("formatEmploymentDuration", () => {
  it("lists years, months and days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));

    expect(formatEmploymentDuration("2024-04-12")).toBe("2 years, 2 months, 3 days");
  });

  it("singularises a one-year, one-month, one-day span", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));

    expect(formatEmploymentDuration("2025-05-15")).toBe("1 year, 1 month, 1 day");
  });

  it("is an approximation — dayjs.duration divides a millisecond span, it does not walk the calendar", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));

    // Calendar-exact, 15 May 2025 to 15 June 2026 is 1 year and 1 month with no
    // days left over. dayjs.duration works off fixed averages (365.25 days to a
    // year, 30.44 to a month), so it reports an extra day. Fine for a profile
    // line, and pinned here so nobody assumes it is exact.
    expect(formatEmploymentDuration("2025-05-15")).toBe("1 year, 1 month, 1 day");
    expect(formatEmploymentDuration("2026-06-14")).toBe("1 day");
  });

  it("omits the parts that are zero", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));

    expect(formatEmploymentDuration("2025-06-15")).toBe("1 year");
  });

  it("returns an empty string for someone who started today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));

    // Every part is zero, so there is nothing to join. The profile screen shows
    // a blank rather than "0 days".
    expect(formatEmploymentDuration("2026-06-15")).toBe("");
  });
});
