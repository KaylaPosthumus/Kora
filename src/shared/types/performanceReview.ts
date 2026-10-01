import { ReviewStatus } from "./common";

// In Backend: PerformanceReviewDTO

export interface PerformanceReview {
  reviewId: string;
  adminId: string;
  adminName: string;
  employeeId: string;
  employeeName: string;

  isOnline: boolean;
  meetLocation: string | null;
  meetLink: string | null;
  startDate: string;
  endDate: string;
  rating: number | null;
  comment: string | null;
  docUrl: string | null;
  status: ReviewStatus;
}
