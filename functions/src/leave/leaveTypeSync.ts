/**
 * Keeping leave balances in step with the leave types they are derived from.
 *
 * `setupUserAsEmployee` seeds one balance per leave type *at the moment an
 * employee is created*, copying `leaveTypeName`, `description` and `defaultDays`
 * onto each balance document. Nothing has kept that in step since, which leaves
 * two holes:
 *
 * 1. **A leave type added later reaches nobody.** Existing employees get no
 *    balance document for it. That is not merely cosmetic: `setLeaveRequestStatus`
 *    decrements only `if (delta !== 0 && balanceSnapshot.exists())`, so a request
 *    against a leave type the employee has no balance for is approved and the
 *    days are **silently never deducted**.
 * 2. **Renaming a leave type, or changing its default, leaves every balance
 *    stale.** The copied fields are what the employee's leave screen displays.
 *
 * `remainingDays` is never mirrored — it is the employee's own consumed state,
 * and overwriting it from `defaultDays` would hand back days already taken.
 */

/** A `leaveTypes/{leaveTypeId}` document. */
export interface LeaveTypeDoc {
  leaveTypeName?: unknown;
  description?: unknown;
  defaultDays?: unknown;
}

/** The fields a balance copies from its leave type. */
export interface MirroredFields {
  leaveTypeId: string;
  leaveTypeName: unknown;
  description: unknown;
  defaultDays: unknown;
}

/** What a sync decided to do. Ids are employee ids. */
export interface LeaveTypeSyncPlan {
  /** Employees with no balance for this type; created with a full allowance. */
  toCreate: string[];
  /** Employees whose balance needs its copied fields refreshed. */
  toUpdate: string[];
  /** Employees whose balance for this type should go. */
  toDelete: string[];
  /** The values to write for creates and updates. */
  fields: MirroredFields | null;
}

/** The subset of a leave type that balances denormalise. */
export const mirroredFields = (
  leaveTypeId: string,
  leaveType: LeaveTypeDoc
): MirroredFields => ({
  leaveTypeId,
  leaveTypeName: leaveType.leaveTypeName ?? null,
  description: leaveType.description ?? null,
  defaultDays: leaveType.defaultDays ?? 0,
});

/**
 * A brand-new balance document.
 *
 * Matches what `setupUserAsEmployee` writes, so a backfilled employee is
 * indistinguishable from one created after the leave type existed.
 */
export const newBalance = (fields: MirroredFields): Record<string, unknown> => ({
  ...fields,
  remainingDays: typeof fields.defaultDays === "number" ? fields.defaultDays : 0,
});

/** Whether any denormalised field actually differs between two versions. */
export const mirrorChanged = (before: LeaveTypeDoc, after: LeaveTypeDoc): boolean =>
  before.leaveTypeName !== after.leaveTypeName ||
  before.description !== after.description ||
  before.defaultDays !== after.defaultDays;

/**
 * Decides what a leave type write implies for balances.
 *
 * @param before the leave type before the write, or undefined on create
 * @param after the leave type after the write, or undefined on delete
 * @param allEmployeeIds every employee in the organisation
 * @param employeesWithBalance those that already hold a balance for this type
 */
export const planLeaveTypeSync = (
  leaveTypeId: string,
  before: LeaveTypeDoc | undefined,
  after: LeaveTypeDoc | undefined,
  allEmployeeIds: readonly string[],
  employeesWithBalance: ReadonlySet<string>
): LeaveTypeSyncPlan => {
  const empty: LeaveTypeSyncPlan = {
    toCreate: [],
    toUpdate: [],
    toDelete: [],
    fields: null,
  };

  // Deleted: the balances are unusable — a balance keyed to a leave type that
  // no longer exists cannot be requested against or displayed — so they go the
  // same way `onEmployeeDeleted` takes a departed employee's dependents.
  if (after === undefined) {
    return { ...empty, toDelete: allEmployeeIds.filter((id) => employeesWithBalance.has(id)) };
  }

  const fields = mirroredFields(leaveTypeId, after);

  // Created: give every existing employee the new allowance. Without this they
  // can have leave approved against it that is never deducted.
  if (before === undefined) {
    return {
      ...empty,
      fields,
      toCreate: allEmployeeIds.filter((id) => !employeesWithBalance.has(id)),
    };
  }

  // Updated but nothing denormalised changed — a write that touched some other
  // field entirely. Doing nothing keeps this off the hot path.
  if (!mirrorChanged(before, after)) return { ...empty, fields };

  return {
    ...empty,
    fields,
    toUpdate: allEmployeeIds.filter((id) => employeesWithBalance.has(id)),
    // An employee who somehow missed the backfill is given one now.
    toCreate: allEmployeeIds.filter((id) => !employeesWithBalance.has(id)),
  };
};

/**
 * The fields an update writes.
 *
 * Deliberately excludes `remainingDays`: a rename must not restore days the
 * employee has already spent.
 */
export const mirrorUpdate = (fields: MirroredFields): Record<string, unknown> => ({
  leaveTypeName: fields.leaveTypeName,
  description: fields.description,
  defaultDays: fields.defaultDays,
});
