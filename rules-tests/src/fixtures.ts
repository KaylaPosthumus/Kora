/**
 * The cast and the documents these tests run against.
 *
 * Kept in one place because almost every test needs the same three people, and
 * because the *claims* each one carries are the subject of half the suite —
 * they are easier to compare when they sit side by side.
 */

import { seed, type Caller } from "./harness";

// People -------------------------------------------------------------------

/**
 * A linked employee whose token carries the claims `syncRoleClaim` writes.
 *
 * Note there is no `suspended` claim. That is not an oversight in the fixture —
 * `nextSuspensionClaims` removes the key on reinstatement and never writes
 * `false`, so "absent" is the real shape of a token for everyone who has never
 * been suspended. See `sam_beforeRefresh` for the other half of the story.
 */
export const sam: Caller = {
  uid: "uid-sam",
  claims: { role: "employee", employeeId: "emp-sam" },
};

/**
 * The same person, moments after an admin linked them.
 *
 * `syncRoleClaim` has not run, or it has run and their ID token has not
 * refreshed yet — up to an hour on its own. The rules are supposed to fall back
 * to `users/{uid}` here, which is the behaviour CLAUDE.md calls "load-bearing".
 */
export const sam_beforeRefresh: Caller = { uid: "uid-sam" };

/** Sam, suspended. The claim is present and true only while suspended. */
export const sam_suspended: Caller = {
  uid: "uid-sam",
  claims: { role: "employee", employeeId: "emp-sam", suspended: true },
};

/** A second employee, so "someone else's record" has a real owner. */
export const jo: Caller = {
  uid: "uid-jo",
  claims: { role: "employee", employeeId: "emp-jo" },
};

export const admin: Caller = {
  uid: "uid-admin",
  claims: { role: "admin", adminId: "adm-1" },
};

/** An admin before their token refreshed — the isAdmin() fallback case. */
export const admin_beforeRefresh: Caller = { uid: "uid-admin" };

/** Signed up, never linked. The state every UI signup lands in. */
export const nobody: Caller = { uid: "uid-nobody", claims: { role: "unassigned" } };

// Documents ----------------------------------------------------------------

/** A leave request as `createLeaveRequest` writes it. */
export const leaveRequest = (
  overrides: Record<string, unknown> = {}
): Record<string, unknown> => ({
  employeeId: "emp-sam",
  employeeName: "Sam Employee",
  leaveTypeId: "annual",
  startDate: "2026-03-02",
  endDate: "2026-03-06",
  comment: "Away",
  status: "pending",
  ...overrides,
});

/** A meeting as `createMeetingRequest` writes it — dates null until scheduled. */
export const meeting = (
  overrides: Record<string, unknown> = {}
): Record<string, unknown> => ({
  employeeId: "emp-sam",
  employeeName: "Sam Employee",
  adminId: "adm-1",
  adminName: "Alex Admin",
  purpose: "Catch-up",
  startDate: null,
  endDate: null,
  status: "requested",
  ...overrides,
});

/**
 * Seeds the whole cast.
 *
 * Every test gets the same world so a failure is about the rule under test and
 * not about which fixture that particular test forgot.
 */
export const seedWorld = async (): Promise<void> => {
  await Promise.all([
    seed("users/uid-sam", {
      fullName: "Sam Employee",
      email: "sam@example.com",
      role: "employee",
      isLinked: true,
      employeeId: "emp-sam",
    }),
    seed("users/uid-jo", {
      fullName: "Jo Employee",
      email: "jo@example.com",
      role: "employee",
      isLinked: true,
      employeeId: "emp-jo",
    }),
    seed("users/uid-admin", {
      fullName: "Alex Admin",
      email: "alex@example.com",
      role: "admin",
      isLinked: true,
      adminId: "adm-1",
    }),
    seed("users/uid-nobody", {
      fullName: "New Signup",
      email: "new@example.com",
      role: "unassigned",
      isLinked: false,
    }),

    seed("employees/emp-sam", {
      userId: "uid-sam",
      fullName: "Sam Employee",
      email: "sam@example.com",
      phoneNumber: "0000000000",
      gender: "other",
      dateOfBirth: "1990-01-01",
      jobTitle: "Engineer",
      salaryAmount: 100000,
      payCycle: "monthly",
      employType: "fullTime",
      isSuspended: false,
    }),
    seed("employees/emp-jo", {
      userId: "uid-jo",
      fullName: "Jo Employee",
      salaryAmount: 120000,
      payCycle: "monthly",
      employType: "fullTime",
      isSuspended: false,
    }),
    seed("employees/emp-sam/leaveBalances/annual", {
      leaveTypeId: "annual",
      leaveTypeName: "Annual",
      defaultDays: 20,
      remainingDays: 15,
    }),

    seed("admins/adm-1", { userId: "uid-admin", fullName: "Alex Admin" }),
    seed("leaveTypes/annual", { leaveTypeName: "Annual", defaultDays: 20 }),
    seed("equipmentCategories/laptop", { equipmentCatName: "Laptop" }),
    seed("equipment/kit-1", {
      equipmentCatId: "laptop",
      equipmentCategoryName: "Laptop",
      employeeId: "emp-sam",
      condition: "good",
    }),
    seed("equipment/kit-2", {
      equipmentCatId: "laptop",
      equipmentCategoryName: "Laptop",
      employeeId: null,
      condition: "new",
    }),
  ]);
};
