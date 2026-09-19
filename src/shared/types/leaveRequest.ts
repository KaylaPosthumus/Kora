import { LeaveStatus } from "./common";

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

  // Denormalised from the leave type so the lists render without a lookup.
  leaveTypeName: string;
  description: string;
  defaultDays: number;
}
