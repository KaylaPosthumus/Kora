// In Backend: EmpUserRatingMetricsDTO

export interface EmpUserRatingMetrics {
  employeeId: string;
  fullName: string;
  averageRating: number;
  numberOfRatings: number;
  mostRecentRating: number;
}
