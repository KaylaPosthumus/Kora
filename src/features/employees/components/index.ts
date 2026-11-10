/**
 * Public surface of the employees feature's components.
 *
 * Other features import from this barrel and never from a file beside it;
 * within this feature, import the file directly — routing a sibling through
 * here would make the barrel import itself.
 */

export { default as AdminEditEmpDetailsModal } from "./AdminEditEmpDetailsModal";
export { default as AdminEditEmpPayrollModal } from "./AdminEditEmpPayrollModal";
export { default as EmpEditEmpDetailsModal } from "./EmpEditEmpDetailsModal";
export { default as EmployTypeBadge } from "./EmployTypeBadge";
export { default as TerminateEmployeeModal } from "./TerminateEmployeeModal";
export { default as TimeTodayBadge } from "./TimeTodayBadge";
export { default as UnlinkedUserDropdown } from "./UnlinkedUserDropdown";
export type { UnlinkedUser } from "./UnlinkedUserDropdown";
