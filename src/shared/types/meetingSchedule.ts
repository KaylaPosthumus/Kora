export interface MeetingSchedule {
  isOnline: boolean;
  meetLocation: string | null;
  meetLink: string | null;
  startDate: string;
  endDate: string;
}
