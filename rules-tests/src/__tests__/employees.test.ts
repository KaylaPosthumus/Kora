/**
 * `employees/{employeeId}` — where the money lives.
 *
 * An employee maintains their own contact details. Salary, pay cycle,
 * employment type and suspension are admin-only: those are the fields with a
 * money or status implication, and an employee who could write them could give
 * themselves a raise or lift their own suspension.
 */

import { describe, it, expect, beforeEach } from "vitest";

import { ALLOW, DENY, as, useEmulator } from "../harness";
import { admin, jo, nobody, sam, sam_suspended, seedWorld } from "../fixtures";

useEmulator();
beforeEach(seedWorld);

describe("an employee maintaining their own record", () => {
  it("may change their contact details", async () => {
    expect(
      await as(sam).update("employees/emp-sam", { phoneNumber: "0123456789" })
    ).toBe(ALLOW);
    expect(
      await as(sam).update("employees/emp-sam", {
        fullName: "Sam Renamed",
        dateOfBirth: "1991-02-03",
        gender: "female",
      })
    ).toBe(ALLOW);
  });

  it("may not change their own salary", async () => {
    expect(
      await as(sam).update("employees/emp-sam", { salaryAmount: 999999 })
    ).toBe(DENY);
  });

  it("may not change their pay cycle or employment type", async () => {
    expect(await as(sam).update("employees/emp-sam", { payCycle: "weekly" })).toBe(
      DENY
    );
    expect(
      await as(sam).update("employees/emp-sam", { employType: "contract" })
    ).toBe(DENY);
  });

  it("may not lift their own suspension", async () => {
    expect(
      await as(sam_suspended).update("employees/emp-sam", { isSuspended: false })
    ).toBe(DENY);
  });

  it("may not smuggle a salary change alongside a phone number", async () => {
    expect(
      await as(sam).update("employees/emp-sam", {
        phoneNumber: "0123456789",
        salaryAmount: 999999,
      })
    ).toBe(DENY);
  });

  it("may not repoint their record at another user account", async () => {
    expect(await as(sam).update("employees/emp-sam", { userId: "uid-jo" })).toBe(DENY);
  });

  it("may not edit another employee's record", async () => {
    expect(await as(jo).update("employees/emp-sam", { phoneNumber: "666" })).toBe(DENY);
  });

  it("may not create or delete an employee record", async () => {
    expect(
      await as(sam).set("employees/emp-invented", { userId: "uid-sam", fullName: "X" })
    ).toBe(DENY);
    expect(await as(sam).remove("employees/emp-sam")).toBe(DENY);
  });

  // Suspension gates writes only — the employee can still see their own record.
  it("may still read their own record while suspended", async () => {
    expect(await as(sam_suspended).get("employees/emp-sam")).toBe(ALLOW);
  });

  it("may not write while suspended", async () => {
    expect(
      await as(sam_suspended).update("employees/emp-sam", { phoneNumber: "0000" })
    ).toBe(DENY);
  });
});

describe("enum validation", () => {
  it("accepts the documented values", async () => {
    expect(await as(sam).update("employees/emp-sam", { gender: "other" })).toBe(ALLOW);
    expect(
      await as(admin).update("employees/emp-sam", {
        payCycle: "biWeekly",
        employType: "intern",
      })
    ).toBe(ALLOW);
  });

  it("rejects a value outside the set, even from an admin", async () => {
    expect(await as(admin).update("employees/emp-sam", { gender: "Male" })).toBe(DENY);
    expect(
      await as(admin).update("employees/emp-sam", { payCycle: "fortnightly" })
    ).toBe(DENY);
    expect(
      await as(admin).update("employees/emp-sam", { employType: "permanent" })
    ).toBe(DENY);
  });

  // The rule reads each enum through get() with an in-set default, so a write
  // that simply does not carry the field must not error into a denial.
  it("accepts a write that omits the enum fields", async () => {
    expect(
      await as(admin).update("employees/emp-sam", { jobTitle: "Staff Engineer" })
    ).toBe(ALLOW);
  });
});

describe("an admin managing employees", () => {
  it("may create, edit and delete", async () => {
    expect(
      await as(admin).set("employees/emp-new", {
        userId: "uid-nobody",
        fullName: "New Person",
        salaryAmount: 90000,
        payCycle: "monthly",
        employType: "fullTime",
        gender: "other",
        isSuspended: false,
      })
    ).toBe(ALLOW);
    expect(
      await as(admin).update("employees/emp-sam", { salaryAmount: 123456 })
    ).toBe(ALLOW);
    expect(await as(admin).remove("employees/emp-jo")).toBe(ALLOW);
  });

  it("may suspend an employee", async () => {
    expect(
      await as(admin).update("employees/emp-sam", { isSuspended: true })
    ).toBe(ALLOW);
  });

  it("may list every employee", async () => {
    expect(await as(admin).query("employees", "isSuspended", false)).toBe(ALLOW);
  });
});

describe("leave balances", () => {
  it("are readable by their owner", async () => {
    expect(await as(sam).get("employees/emp-sam/leaveBalances/annual")).toBe(ALLOW);
  });

  it("are not readable by another employee", async () => {
    expect(await as(jo).get("employees/emp-sam/leaveBalances/annual")).toBe(DENY);
  });

  it("are not readable by an unlinked user", async () => {
    expect(await as(nobody).get("employees/emp-sam/leaveBalances/annual")).toBe(DENY);
  });

  // The one that would let an employee grant themselves leave.
  it("are not writable by their owner", async () => {
    expect(
      await as(sam).update("employees/emp-sam/leaveBalances/annual", {
        remainingDays: 365,
      })
    ).toBe(DENY);
  });

  it("are writable by an admin", async () => {
    expect(
      await as(admin).update("employees/emp-sam/leaveBalances/annual", {
        remainingDays: 10,
      })
    ).toBe(ALLOW);
  });
});
