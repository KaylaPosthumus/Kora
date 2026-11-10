/**
 * Shared enums.
 *
 * These used to be numeric ("matching the backend values") because the .NET API
 * stored ints. Firestore documents are read by humans in the console and by
 * security rules, so the stored values are now readable strings.
 *
 * Comparison sites still go through the enum (`status === LeaveStatus.Approved`),
 * so they keep working unchanged. What does NOT survive the switch is TypeScript's
 * reverse mapping (`Gender[0] === "Male"`) — string enums don't get one. Use the
 * *Labels maps below wherever a human-readable name is needed.
 */

/** Gender of an employee. */
export enum Gender {
  Male = "male",
  Female = "female",
  Other = "other",
}

export const GenderLabels: Record<Gender, string> = {
  [Gender.Male]: "Male",
  [Gender.Female]: "Female",
  [Gender.Other]: "Other",
};

/** How often an employee is paid. */
export enum PayCycle {
  Monthly = "monthly",
  BiWeekly = "biWeekly",
  Weekly = "weekly",
}

export const PayCycleLabels: Record<PayCycle, string> = {
  [PayCycle.Monthly]: "Monthly",
  [PayCycle.BiWeekly]: "Bi-Weekly",
  [PayCycle.Weekly]: "Weekly",
};

/** Employment type. */
export enum EmployType {
  FullTime = "fullTime",
  PartTime = "partTime",
  Contract = "contract",
  Intern = "intern",
}

export const EmployTypeLabels: Record<EmployType, string> = {
  [EmployType.FullTime]: "Full Time",
  [EmployType.PartTime]: "Part Time",
  [EmployType.Contract]: "Contract",
  [EmployType.Intern]: "Intern",
};

/** Condition of an equipment item. */
export enum EquipmentCondition {
  New = "new",
  Good = "good",
  Decent = "decent",
  Used = "used",
}

export const EquipmentConditionLabels: Record<EquipmentCondition, string> = {
  [EquipmentCondition.New]: "New",
  [EquipmentCondition.Good]: "Good",
  [EquipmentCondition.Decent]: "Decent",
  [EquipmentCondition.Used]: "Used",
};

/**
 * Equipment categories.
 *
 * These double as the document IDs in the `equipmentCategories` collection, so a
 * category reference is readable in the console without a lookup.
 */
export enum EquipmentCategory {
  Cellphone = "cellphone",
  Tablet = "tablet",
  Laptop = "laptop",
  Monitor = "monitor",
  Headset = "headset",
  Keyboard = "keyboard",
}

export const EquipmentCategoryLabels: Record<EquipmentCategory, string> = {
  [EquipmentCategory.Cellphone]: "Cellphone",
  [EquipmentCategory.Tablet]: "Tablet",
  [EquipmentCategory.Laptop]: "Laptop",
  [EquipmentCategory.Monitor]: "Monitor",
  [EquipmentCategory.Headset]: "Headset",
  [EquipmentCategory.Keyboard]: "Keyboard",
};

/** Status of a performance review. */
export enum ReviewStatus {
  Pending = "pending",
  Upcoming = "upcoming",
  Completed = "completed",
}

export const ReviewStatusLabels: Record<ReviewStatus, string> = {
  [ReviewStatus.Pending]: "Pending",
  [ReviewStatus.Upcoming]: "Upcoming",
  [ReviewStatus.Completed]: "Completed",
};

/** Role stored on the `users/{uid}` doc and mirrored into a custom claim. */
export enum UserRole {
  Unassigned = "unassigned",
  Employee = "employee",
  Admin = "admin",
}

export const UserRoleLabels: Record<UserRole, string> = {
  [UserRole.Unassigned]: "Unassigned",
  [UserRole.Employee]: "Employee",
  [UserRole.Admin]: "Admin",
};

/** Status of a leave request. */
export enum LeaveStatus {
  Pending = "pending",
  Approved = "approved",
  Rejected = "rejected",
}

export const LeaveStatusLabels: Record<LeaveStatus, string> = {
  [LeaveStatus.Pending]: "Pending",
  [LeaveStatus.Approved]: "Approved",
  [LeaveStatus.Rejected]: "Rejected",
};

/** Discriminator for the merged meeting + performance review view. */
export enum GatheringType {
  PerformanceReview = "performanceReview",
  Meeting = "meeting",
}

export const GatheringTypeLabels: Record<GatheringType, string> = {
  [GatheringType.PerformanceReview]: "Performance Review",
  [GatheringType.Meeting]: "Meeting",
};

/** Status of a meeting. */
export enum MeetStatus {
  Requested = "requested",
  Upcoming = "upcoming",
  Rejected = "rejected",
  Completed = "completed",
}

export const MeetStatusLabels: Record<MeetStatus, string> = {
  [MeetStatus.Requested]: "Requested",
  [MeetStatus.Upcoming]: "Upcoming",
  [MeetStatus.Rejected]: "Rejected",
  [MeetStatus.Completed]: "Completed",
};
