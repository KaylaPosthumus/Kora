/**
 * The Kora backend — the half of CoriCore a browser cannot do.
 *
 * The client talks to Firestore directly for ordinary CRUD (see
 * `src/services/api.service.ts`); what lives here is the work that needs
 * credentials no browser should hold, or that must happen whether or not a
 * client remembered to ask.
 *
 * Every export in this file becomes a deployed function, so re-export
 * deliberately rather than with a wildcard.
 */

// Authorisation: keeps the role claim in step with the user document.
export { syncRoleClaim } from "./claims/syncRoleClaim";

// Referential integrity: cleans up after a deleted employee record.
export { onEmployeeDeleted } from "./employees/onEmployeeDeleted";

// Referential integrity: unlinks a departed admin from their gatherings,
// without destroying the employee review history attached to them.
export { onAdminDeleted } from "./admins/onAdminDeleted";

// Denormalisation: keeps equipment's copy of its category name current.
export { onEquipmentCategoryWritten } from "./equipment/onEquipmentCategoryWritten";

// Referential integrity: removes the Firestore records a deleted auth
// account would otherwise leave behind.
export { onUserDeleted } from "./users/onUserDeleted";

// Leave balances: the admin correction path CoriCore's LeaveBalance API had,
// and the propagation that keeps balances in step with their leave types.
export { adjustLeaveBalance } from "./leave/adjustLeaveBalance";
export { onLeaveTypeWritten } from "./leave/onLeaveTypeWritten";
export { onLeaveRequestWritten } from "./leave/onLeaveRequestWritten";

// Email verification: CoriCore's 6-digit code, rebuilt.
export {
  requestEmailVerification,
  confirmEmailVerification,
} from "./email/verifyEmail";
