/**
 * The admin dashboard aggregates.
 *
 * These were SQL `GROUP BY`s on the old backend. Computing them in JS means
 * reading every employee and every completed review on each dashboard load —
 * acceptable at one company's scale, and the first thing to move into a Cloud
 * Function or a precomputed aggregate document if that stops being true.
 */

import {
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import {
  EmployType,
  LeaveStatus,
  ReviewStatus,
} from "@/shared/types/common";
import {
  ok,
  employeesCol,
  adminsCol,
  leaveRequestsCol,
  performanceReviewsCol,
  toEmpUser,
  toLeaveRequest,
} from "@/shared/lib/firestore";
import type {
  ApiResponse,
} from "@/shared/lib/firestore";
import { ratingMetricsFor } from "@/features/employees/api/employeesApi";

/**
 * The admin dashboard aggregates.
 *
 * These were SQL `GROUP BY`s on the old backend; here they're computed in JS over
 * the employee and review collections. That means reading every employee and
 * every completed review on each dashboard load — acceptable for one company,
 * and the first thing to move into a Cloud Function or a precomputed aggregate
 * doc if the numbers ever grow.
 */
export const getAdminDashboardData = async (adminId: string): Promise<ApiResponse<any>> => {
  const [adminSnapshot, employeesSnapshot, reviewsSnapshot, leaveSnapshot] = await Promise.all([
    getDoc(doc(adminsCol, adminId)),
    getDocs(employeesCol),
    getDocs(query(performanceReviewsCol, where("status", "==", ReviewStatus.Completed))),
    getDocs(
      query(
        leaveRequestsCol,
        where("status", "==", LeaveStatus.Pending),
        orderBy("createdAt", "desc"),
        limit(20)
      )
    ),
  ]);

  const employees = employeesSnapshot.docs.map((d) => toEmpUser(d.id, d.data()));

  const employeeStatusTotals = {
    totalEmployees: employees.length,
    totalFullTimeEmployees: employees.filter((e) => e.employType === EmployType.FullTime).length,
    totalPartTimeEmployees: employees.filter((e) => e.employType === EmployType.PartTime).length,
    totalInternEmployees: employees.filter((e) => e.employType === EmployType.Intern).length,
    totalContractEmployees: employees.filter((e) => e.employType === EmployType.Contract).length,
    totalSuspendedEmployees: employees.filter((e) => e.isSuspended).length,
  };

  const reviewsByEmployee = new Map<string, { rating: number | null; startDate: string }[]>();
  reviewsSnapshot.docs.forEach((d) => {
    const data = d.data();
    const existing = reviewsByEmployee.get(data.employeeId) ?? [];
    existing.push({ rating: data.rating ?? null, startDate: data.startDate });
    reviewsByEmployee.set(data.employeeId, existing);
  });

  const allMetrics = employees
    .map((employee) =>
      ratingMetricsFor(
        employee.employeeId,
        employee.fullName,
        reviewsByEmployee.get(employee.employeeId) ?? []
      )
    )
    .filter((metrics) => metrics.numberOfRatings > 0)
    .sort((a, b) => b.averageRating - a.averageRating);

  const employeesById = new Map(employees.map((employee) => [employee.employeeId, employee]));

  return ok({
    adminUser: adminSnapshot.exists()
      ? {
          adminId: adminSnapshot.id,
          userId: adminSnapshot.data().userId,
          fullName: adminSnapshot.data().fullName ?? null,
          email: adminSnapshot.data().email ?? null,
        }
      : null,
    // Bar chart: best five.
    empUserRatingMetrics: allMetrics.slice(0, 5),
    employeeStatusTotals,
    leaveRequests: leaveSnapshot.docs.map((d) => toLeaveRequest(d.id, d.data())),
    // Card list: best three, each paired with the employee it belongs to.
    topRatedEmployees: allMetrics.slice(0, 3).map((metrics) => ({
      employee: employeesById.get(metrics.employeeId) ?? null,
      rating: metrics,
    })),
  });
};
