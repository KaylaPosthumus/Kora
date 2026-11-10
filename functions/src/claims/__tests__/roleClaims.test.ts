import { describe, it, expect } from "vitest";

import {
  claimsEqual,
  desiredClaims,
  nextClaims,
  type RoleClaims,
} from "../roleClaims";

describe("desiredClaims", () => {
  it("mirrors a linked employee's role and employee id", () => {
    expect(desiredClaims({ role: "employee", employeeId: "emp1" })).toEqual({
      role: "employee",
      employeeId: "emp1",
    });
  });

  it("mirrors a linked admin's role and admin id", () => {
    expect(desiredClaims({ role: "admin", adminId: "adm1" })).toEqual({
      role: "admin",
      adminId: "adm1",
    });
  });

  it("carries both ids when a user is linked to an employee and an admin record", () => {
    expect(
      desiredClaims({ role: "admin", adminId: "adm1", employeeId: "emp1" })
    ).toEqual({ role: "admin", adminId: "adm1", employeeId: "emp1" });
  });

  it("gives a fresh signup the unassigned role and no ids", () => {
    expect(desiredClaims({ role: "unassigned" })).toEqual({ role: "unassigned" });
  });

  // The rules read `request.auth.token.employeeId != null`. Emitting the key as
  // null rather than omitting it would make that test pass for a user with no
  // employee record.
  it("omits an id that is null rather than emitting it", () => {
    expect(desiredClaims({ role: "employee", employeeId: null, adminId: null })).toEqual({
      role: "employee",
    });
  });

  it("omits an id that is an empty string", () => {
    expect(desiredClaims({ role: "employee", employeeId: "" })).toEqual({
      role: "employee",
    });
  });

  // A malformed document must leave the user with no privileges. Throwing would
  // wedge the trigger in a retry loop against a document that will not change.
  it.each([
    ["a role that is not one of the three", { role: "superuser" }],
    ["a numeric role left over from the .NET contract", { role: 2 }],
    ["no role field at all", {}],
    ["an explicitly null role", { role: null }],
  ])("degrades %s to unassigned", (_label, user) => {
    expect(desiredClaims(user as Record<string, unknown>)).toEqual({
      role: "unassigned",
    });
  });

  it("never grants admin from a non-string role", () => {
    expect(desiredClaims({ role: ["admin"] })?.role).toBe("unassigned");
  });

  it("drops an id that is not a string", () => {
    expect(desiredClaims({ role: "employee", employeeId: 7 })).toEqual({
      role: "employee",
    });
  });

  it("returns null for a deleted user document", () => {
    expect(desiredClaims(undefined)).toBeNull();
  });
});

describe("nextClaims", () => {
  it("writes the managed keys onto an empty token", () => {
    expect(nextClaims(undefined, { role: "employee", employeeId: "emp1" })).toEqual({
      role: "employee",
      employeeId: "emp1",
    });
  });

  // setCustomUserClaims replaces the whole object, so anything it does not
  // rewrite is dropped. Claims this function does not own must survive.
  it("preserves claims it does not manage", () => {
    expect(
      nextClaims({ role: "unassigned", tenant: "acme" }, { role: "admin", adminId: "adm1" })
    ).toEqual({ role: "admin", adminId: "adm1", tenant: "acme" });
  });

  // The demotion case: an admin unlinked back to unassigned must lose adminId,
  // or the rules keep reading a stale id off the token.
  it("clears a managed id that is no longer desired", () => {
    expect(
      nextClaims({ role: "admin", adminId: "adm1" }, { role: "unassigned" })
    ).toEqual({ role: "unassigned" });
  });

  it("clears every managed key when the user document is deleted", () => {
    expect(
      nextClaims({ role: "admin", adminId: "adm1", employeeId: "emp1" }, null)
    ).toEqual({});
  });

  it("keeps unmanaged claims when the user document is deleted", () => {
    expect(nextClaims({ role: "admin", tenant: "acme" }, null)).toEqual({
      tenant: "acme",
    });
  });

  it("does not mutate the object it was given", () => {
    const existing = { role: "unassigned", tenant: "acme" };
    nextClaims(existing, { role: "admin", adminId: "adm1" });
    expect(existing).toEqual({ role: "unassigned", tenant: "acme" });
  });
});

describe("claimsEqual", () => {
  it("treats key order as irrelevant", () => {
    expect(
      claimsEqual({ role: "employee", employeeId: "emp1" }, { employeeId: "emp1", role: "employee" })
    ).toBe(true);
  });

  it("spots a changed value", () => {
    expect(claimsEqual({ role: "employee" }, { role: "admin" })).toBe(false);
  });

  it("spots an added key", () => {
    expect(claimsEqual({ role: "employee" }, { role: "employee", employeeId: "emp1" })).toBe(
      false
    );
  });

  it("spots a removed key", () => {
    expect(claimsEqual({ role: "admin", adminId: "adm1" }, { role: "admin" })).toBe(false);
  });

  it("treats undefined and an empty object as the same", () => {
    expect(claimsEqual(undefined, {})).toBe(true);
  });

  // The no-op path that matters: an employee edits their profile picture, the
  // trigger fires, and nothing about the token has changed.
  it("reports no change for an unrelated user-document edit", () => {
    const claims: RoleClaims = { role: "employee", employeeId: "emp1" };
    const before = nextClaims({}, claims);
    const after = nextClaims(before, desiredClaims({
      role: "employee",
      employeeId: "emp1",
      profilePicture: "https://example.test/new.png",
    } as Record<string, unknown>));

    expect(claimsEqual(before, after)).toBe(true);
  });
});
