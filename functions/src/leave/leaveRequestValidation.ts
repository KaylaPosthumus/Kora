/**
 * Checking a leave request for the problems `firestore.rules` cannot see.
 *
 * The rules now enforce what they can express on a single document —
 * `startDate <= endDate`, a legal status, and immutable ids. Two checks need
 * information from *other* documents, which rules cannot query:
 *
 * - **Overlap.** Two approved requests covering the same day mean the employee
 *   is booked off twice and the balance was debited twice.
 * - **Sufficient balance.** Requires the leave balance and a computed duration.
 *
 * Neither is enforced as a hard block. Over-drawing a balance is a deliberate,
 * supported flow — `setLeaveRequestStatus` does not clamp at zero and
 * `OverBalanceConfirmModal` warns the admin, who may proceed. So this produces a
 * *verdict* an admin can act on, not a refusal.
 */

/** The fields of a `leaveRequests/{id}` document this looks at. */
export interface LeaveRequestDoc {
  employeeId?: unknown;
  leaveTypeId?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  status?: unknown;
}

/** Another request to check against, with its id. */
export interface OtherRequest extends LeaveRequestDoc {
  id: string;
}

export type LeaveIssue =
  | { code: "invalid-dates"; message: string }
  | { code: "inverted-dates"; startDate: string; endDate: string }
  | { code: "overlaps"; conflicts: Array<{ id: string; status: string }> }
  | { code: "insufficient-balance"; requestedDays: number; remainingDays: number }
  | { code: "no-balance"; leaveTypeId: string };

export interface LeaveVerdict {
  valid: boolean;
  issues: LeaveIssue[];
  /** Inclusive day count, or null when the dates could not be read. */
  days: number | null;
}

/** Statuses that consume a balance and therefore conflict with each other. */
export const BLOCKING_STATUSES = ["approved", "pending"] as const;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * The date part of an ISO string as a count of whole UTC days.
 *
 * Only the `YYYY-MM-DD` prefix is read, and the arithmetic is done in UTC.
 * `calculateDurationInDays` in the app uses `dayjs(...).diff(..., "day")`, which
 * parses to *local* midnight; for a difference between two dates the offset
 * cancels, except across a DST boundary where a 23- or 25-hour day can make
 * dayjs's truncating diff land one out. Working in whole UTC days avoids that
 * rather than reproducing it.
 */
export const toEpochDay = (value: unknown): number | null => {
  if (typeof value !== "string") return null;

  const match = DATE_ONLY.exec(value);
  if (!match) return null;

  const [, year, month, day] = match;
  const timestamp = Date.UTC(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(timestamp)) return null;

  // Date.UTC rolls invalid components over (month 13 becomes January), so
  // reject anything that did not survive the round trip.
  const roundTrip = new Date(timestamp);
  if (
    roundTrip.getUTCFullYear() !== Number(year) ||
    roundTrip.getUTCMonth() !== Number(month) - 1 ||
    roundTrip.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return Math.floor(timestamp / 86_400_000);
};

/**
 * Inclusive duration, matching `calculateDurationInDays`: a request that starts
 * and ends on the same day is one day, not zero.
 */
export const durationInDays = (startDate: unknown, endDate: unknown): number | null => {
  const start = toEpochDay(startDate);
  const end = toEpochDay(endDate);
  if (start === null || end === null) return null;
  return end - start + 1;
};

/** Whether two inclusive day ranges share any day. */
export const rangesOverlap = (
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean => aStart <= bEnd && bStart <= aEnd;

/**
 * Judges one request against the employee's other requests and their balance.
 *
 * @param others every *other* request for the same employee
 * @param remainingDays the balance for this leave type, or undefined if none
 */
export const validateLeaveRequest = (
  request: LeaveRequestDoc,
  others: readonly OtherRequest[],
  remainingDays: number | undefined
): LeaveVerdict => {
  const issues: LeaveIssue[] = [];

  const start = toEpochDay(request.startDate);
  const end = toEpochDay(request.endDate);

  if (start === null || end === null) {
    return {
      valid: false,
      days: null,
      issues: [
        {
          code: "invalid-dates",
          message: "startDate and endDate must be ISO dates (YYYY-MM-DD).",
        },
      ],
    };
  }

  const days = end - start + 1;

  // The one that inflates a balance: approving a negative duration applies a
  // positive delta in setLeaveRequestStatus.
  if (days <= 0) {
    issues.push({
      code: "inverted-dates",
      startDate: String(request.startDate),
      endDate: String(request.endDate),
    });
  }

  const conflicts = others
    .filter((other) => {
      if (!BLOCKING_STATUSES.includes(other.status as (typeof BLOCKING_STATUSES)[number])) {
        return false;
      }
      const otherStart = toEpochDay(other.startDate);
      const otherEnd = toEpochDay(other.endDate);
      if (otherStart === null || otherEnd === null) return false;
      return rangesOverlap(start, end, otherStart, otherEnd);
    })
    .map((other) => ({ id: other.id, status: String(other.status) }));

  if (conflicts.length > 0) issues.push({ code: "overlaps", conflicts });

  if (remainingDays === undefined) {
    // No balance document means setLeaveRequestStatus skips the decrement
    // entirely — the days would be approved and never deducted.
    issues.push({ code: "no-balance", leaveTypeId: String(request.leaveTypeId ?? "") });
  } else if (days > 0 && days > remainingDays) {
    issues.push({ code: "insufficient-balance", requestedDays: days, remainingDays });
  }

  return { valid: issues.length === 0, issues, days };
};

/** Whether two verdicts say the same thing, so an unchanged one is not rewritten. */
export const verdictsEqual = (a: LeaveVerdict | undefined, b: LeaveVerdict): boolean =>
  a !== undefined && JSON.stringify(a) === JSON.stringify(b);
