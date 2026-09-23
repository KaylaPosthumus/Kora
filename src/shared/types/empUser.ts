import { EmployType, PayCycle, Gender, UserRole } from "./common";

// In Backend: EmpUserDTO

export interface EmpUser {
  // User Information
  userId: string;
  fullName: string;
  email: string;
  googleId: string | null;
  profilePicture: string | null;
  role: UserRole;

  // Employee Information
  employeeId: string;
  gender: Gender;
  dateOfBirth: string;
  phoneNumber: string;
  jobTitle: string;
  department: string;
  salaryAmount: number;
  payCycle: PayCycle;
  lastPaidDate: string | null;
  employType: EmployType;
  employDate: string;
  isSuspended: boolean;
}
