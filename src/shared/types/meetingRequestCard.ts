import { MeetStatus } from "./common";

export interface MeetingRequestCard {
  meetingId: string;
  employeeId: string;
  employeeName: string;
  profilePicture: string;
  purpose?: string;
  requestedAt: string;
  status: MeetStatus;
}

