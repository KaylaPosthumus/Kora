import { describe, it, expect } from "vitest";

import {
  SUSPENDED_CLAIM,
  isSuspended,
  nextSuspensionClaims,
  suspendedUserId,
  suspensionChanged,
} from "../suspensionClaim";
import { MANAGED_CLAIMS, nextClaims, desiredClaims } from "../roleClaims";

describe("isSuspended", () => {
  it("is true only for a literal true", () => {
    expect(isSuspended({ isSuspended: true })).toBe(true);
  });

  // Being wrong in this direction locks someone out of their own account, so
  // only an explicit true counts.
  it.each([
    ["false", false],
    ["a missing field", undefined],
    ["null", null],
    ["the string 'true'", "true"],
    ["the number 1", 1],
  ])("is false for %s", (_label, value) => {
    expect(isSuspended({ isSuspended: value })).toBe(false);
  });

  it("is false for a missing employee record", () => {
    expect(isSuspended(undefined)).toBe(false);
  });
});

describe("suspendedUserId", () => {
  it("reads the linked user id", () => {
    expect(suspendedUserId({ userId: "uid1" })).toBe("uid1");
  });

  it.each([
    ["no userId", {}],
    ["a null userId", { userId: null }],
    ["an empty userId", { userId: "" }],
    ["a non-string userId", { userId: 7 }],
  ])("returns null for %s", (_label, employee) => {
    expect(suspendedUserId(employee)).toBeNull();
  });
});

describe("nextSuspensionClaims", () => {
  it("adds the claim when suspending", () => {
    expect(nextSuspensionClaims({}, true)).toEqual({ [SUSPENDED_CLAIM]: true });
  });

  // Removed rather than set false, so the rules' `== true` test never meets a
  // stale falsey value and the token stays minimal.
  it("removes the claim when reinstating", () => {
    expect(nextSuspensionClaims({ [SUSPENDED_CLAIM]: true }, false)).toEqual({});
  });

  it("is a no-op when reinstating someone who was never suspended", () => {
    expect(nextSuspensionClaims({ role: "employee" }, false)).toEqual({ role: "employee" });
  });

  // The whole reason the key sits outside MANAGED_CLAIMS.
  it("preserves the role claims syncRoleClaim owns", () => {
    expect(
      nextSuspensionClaims({ role: "employee", employeeId: "emp1" }, true)
    ).toEqual({ role: "employee", employeeId: "emp1", [SUSPENDED_CLAIM]: true });
  });

  it("does not mutate the object it was given", () => {
    const existing = { role: "employee" };
    nextSuspensionClaims(existing, true);
    expect(existing).toEqual({ role: "employee" });
  });
});

describe("suspensionChanged", () => {
  it("is true when suspending", () => {
    expect(suspensionChanged({ isSuspended: false }, { isSuspended: true })).toBe(true);
  });

  it("is true when reinstating", () => {
    expect(suspensionChanged({ isSuspended: true }, { isSuspended: false })).toBe(true);
  });

  it("is false when the flag did not move", () => {
    expect(suspensionChanged({ isSuspended: true }, { isSuspended: true })).toBe(false);
  });

  // A salary edit must not cost a token rewrite.
  it("is false for an unrelated edit", () => {
    expect(
      suspensionChanged(
        { isSuspended: false, userId: "uid1" },
        { isSuspended: false, userId: "uid1" }
      )
    ).toBe(false);
  });

  it("treats a newly created suspended employee as a change", () => {
    expect(suspensionChanged(undefined, { isSuspended: true })).toBe(true);
  });
});

// The two writers must compose: each rewrites only its own keys and carries the
// other's through untouched. setCustomUserClaims replaces the whole object, so
// getting this wrong means one of them silently wipes the other.
describe("the two claim writers together", () => {
  it("keeps the suspension claim out of the role writer's managed set", () => {
    expect([...MANAGED_CLAIMS]).not.toContain(SUSPENDED_CLAIM);
  });

  it("survives a role rewrite landing after a suspension", () => {
    const suspended = nextSuspensionClaims({ role: "employee", employeeId: "emp1" }, true);
    const afterRoleSync = nextClaims(
      suspended,
      desiredClaims({ role: "employee", employeeId: "emp1" })
    );

    expect(afterRoleSync).toEqual({
      role: "employee",
      employeeId: "emp1",
      [SUSPENDED_CLAIM]: true,
    });
  });

  it("survives a suspension landing after a role rewrite", () => {
    const afterRoleSync = nextClaims({}, desiredClaims({ role: "employee", employeeId: "emp1" }));
    const suspended = nextSuspensionClaims(afterRoleSync, true);

    expect(suspended).toEqual({
      role: "employee",
      employeeId: "emp1",
      [SUSPENDED_CLAIM]: true,
    });
  });

  it("does not resurrect a cleared suspension when the role changes", () => {
    const reinstated = nextSuspensionClaims({ role: "employee", [SUSPENDED_CLAIM]: true }, false);
    const afterRoleSync = nextClaims(reinstated, desiredClaims({ role: "admin", adminId: "adm1" }));

    expect(afterRoleSync).not.toHaveProperty(SUSPENDED_CLAIM);
  });
});
