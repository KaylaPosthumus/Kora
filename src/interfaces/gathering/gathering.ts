import { GatheringType, MeetStatus, ReviewStatus } from "../../types/common";

/**
 * A meeting or a performance review, merged for the calendar / gathering lists.
 * The two live in separate Firestore collections and are stitched client-side.
 */
export interface Gathering {
  id: string;
  type: GatheringType;
  adminId: string;
  adminName: string;
  employeeId: string;
  employeeName: string;
  isOnline?: boolean;
  meetLocation?: string;
  meetLink?: string;
  startDate?: string;
  endDate?: string;

  // Meeting-specific properties
  purpose?: string;
  requestedAt?: string;
  meetingStatus?: MeetStatus;

  // Performance Review-specific properties
  rating?: number;
  comment?: string;
  docUrl?: string;
  reviewStatus?: ReviewStatus;
}
