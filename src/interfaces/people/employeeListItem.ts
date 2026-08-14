import { EmployType, Gender, PayCycle } from "../../types/common";

export interface EmployeeListItem {
  empUser: {
    employeeId: string;
    fullName: string;
    gender: Gender;
    jobTitle: string;
    department: string;
    profilePicture: string | null;
    employType: EmployType;
    salaryAmount: number;
    payCycle: PayCycle;
    lastPaidDate: string | null;
    isSuspended: boolean;
  };
  empUserRatingMetrics?: {
    averageRating: number;
    numberOfRatings: number;
  };
  totalLeaveBalanceSum?: {
    totalRemainingDays: number;
    totalLeaveDays: number;
  };
}
