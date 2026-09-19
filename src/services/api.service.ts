/**
 * Compatibility barrel for the old single-file data layer.
 *
 * This file used to be the data layer — 1,500 lines holding the Firestore
 * plumbing and all eleven API groups. Phase 4 step 2 split it along the
 * boundaries it already had: the plumbing into `shared/lib/firestore.ts`, each
 * API group into the feature that owns it.
 *
 * It survives as a re-export barrel purely so that split touched no call site.
 * Step 6 rewrites the imports below to point at the feature modules directly and
 * deletes this file; nothing new should import from here.
 *
 * @deprecated Import from the owning feature's `api/` module instead.
 */

export type { ApiResponse, Unsubscribe } from "@/shared/lib/firestore";

export {
  empUserAPI,
  employeeAPI,
  userAPI,
  adminAPI,
  linkUserAsAdmin,
  ratingMetricsFor,
  getAdminEmpDetails,
  getAdminEmpManagement,
  getEmployeeProfile,
} from "@/features/employees/api/employeesApi";

export { equipmentAPI } from "@/features/equipment/api/equipmentApi";

export {
  leaveTypesAPI,
  empLeaveRequestsAPI,
  subscribeToEmployeeLeave,
  getEmployeeLeaveData,
} from "@/features/leave/api/leaveApi";

export {
  performanceReviewsAPI,
  meetingAPI,
  gatheringAPI,
  getGatherings,
  subscribeToGatherings,
  UPCOMING_AND_COMPLETED,
} from "@/features/gatherings/api/gatheringsApi";

export { getAdminDashboardData } from "@/features/dashboard/api/dashboardApi";

import {
  empUserAPI,
  employeeAPI,
  userAPI,
  adminAPI,
  getAdminEmpDetails,
  getAdminEmpManagement,
  getEmployeeProfile,
} from "@/features/employees/api/employeesApi";
import { equipmentAPI } from "@/features/equipment/api/equipmentApi";
import { getEmployeeLeaveData } from "@/features/leave/api/leaveApi";
import { getAdminDashboardData } from "@/features/dashboard/api/dashboardApi";

/**
 * The page-shaped reads, reassembled into the object call sites destructure.
 *
 * Each member now lives in the feature whose screen it serves; this object only
 * exists to keep `pageAPI.getAdminEmpDetails(...)` resolving while the barrel
 * does. Step 6 rewrites those call sites to import the functions directly.
 */
export const pageAPI = {
  getAdminEmpDetails,
  getAdminEmpManagement,
  getEmployeeProfile,
  getAdminDashboardData,
  getEmployeeLeaveData,
};

export default { empUserAPI, employeeAPI, userAPI, adminAPI, pageAPI, equipmentAPI };
