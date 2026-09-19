import { LeaveStatus } from "./common";

/**
 * One problem the `onLeaveRequestWritten` backend trigger found with a request.
 *
 * Mirrors `LeaveIssue` in `functions/src/leave/leaveRequestValidation.ts`. The
 * two are separate declarations because the browser bundle and the functions
 * package have different dependency trees; they have to be changed together.
 */
export type LeaveIssue =
  | { code: "invalid-dates"; message: string }
  | { code: "inverted-dates"; startDate: string; endDate: string }
  | { code: "overlaps"; conflicts: Array<{ id: string; status: string }> }
  | { code: "insufficient-balance"; requestedDays: number; remainingDays: number }
  | { code: "no-balance"; leaveTypeId: string };

/**
 * The verdict the backend stamps onto every leave request.
 *
 * Advisory, not a block: over-drawing a balance is a supported flow with its own
 * confirmation. What it adds that the client cannot compute is `overlaps` —
 * finding those needs a query across the employee's other requests.
 *
 * Absent on any request written before the trigger was deployed, and on any
 * request whose verdict has not landed yet, so every read of it is optional.
 */
export interface LeaveVerdict {
  valid: boolean;
  issues: LeaveIssue[];
  /** Inclusive day count, or null when the dates could not be read. */
  days: number | null;
}

export interface LeaveRequest {
  leaveRequestId: string;
  employeeId: string;
  employeeName: string;
  /** Same value as `employeeName` — some cards read one, some the other. */
  fullName: string;
  leaveTypeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  comment: string;
  status: LeaveStatus;
  createdAt: string;

  /** The backend's advisory verdict. Absent until its trigger has run. */
  validation?: LeaveVerdict;

  // Denormalised from the leave type so the lists render without a lookup.
  leaveTypeName: string;
  description: string;
  defaultDays: number;
}
