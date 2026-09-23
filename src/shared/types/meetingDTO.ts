import { MeetStatus } from "./common";

export interface MeetingDTO {
  meetingId: string;
  adminId: string;
  adminName: string;
  employeeId: string;
  employeeName: string;
  isOnline: boolean;
  meetLocation: string;
  meetLink: string;
  startDate: string;
  endDate: string;
  purpose: string;
  status: MeetStatus;
}
