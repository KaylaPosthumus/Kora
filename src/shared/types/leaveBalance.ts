// In Backend: LeaveBalanceDTO

export interface LeaveBalance {
  // Leave Balance Information
  leaveBalanceId: string;
  remainingDays: number;

  // Leave Type Information
  leaveTypeName: string;
  description: string;
  defaultDays: number;
}
