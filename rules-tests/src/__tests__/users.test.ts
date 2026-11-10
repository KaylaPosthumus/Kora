/**
 * `users/{userId}` — the privilege boundary the whole rule set rests on.
 *
 * `isAdmin()` trusts `users/{uid}.role`, so a signup free to write that field
 * is self-granted access to every salary and ID number in the organisation.
 * Signup always writes `role: "unassigned"`; the real role arrives at link time
 * from `setupUserAsEmployee` / `linkUserAsAdmin`, both of which run as an admin.
 */

import { describe, it, expect, beforeEach } from "vitest";

import { ALLOW, DENY, as, useEmulator } from "../harness";
import { admin, jo, nobody, sam, seedWorld } from "../fixtures";

useEmulator();
beforeEach(seedWorld);

/** What `EmployeeSignUp` / `AdminSignUp` write. */
const signup = (overrides: Record<string, unknown> = {}) => ({
  fullName: "New Person",
  email: "new.person@example.com",
  role: "unassigned",
  requestedRole: "employee",
  isLinked: false,
  employeeId: null,
  adminId: null,
  ...overrides,
});

describe("signing up", () => {
  const fresh = { uid: "uid-new" };

  it("lets someone create their own unassigned user document", async () => {
    expect(await as(fresh).set("users/uid-new", signup())).toBe(ALLOW);
  });

  it("records the role they asked for without granting it", async () => {
    expect(
      await as(fresh).set("users/uid-new", signup({ requestedRole: "admin" }))
    ).toBe(ALLOW);
  });

  it("refuses a self-granted admin role", async () => {
    expect(await as(fresh).set("users/uid-new", signup({ role: "admin" }))).toBe(DENY);
  });

  it("refuses a self-granted employee role", async () => {
    expect(await as(fresh).set("users/uid-new", signup({ role: "employee" }))).toBe(
      DENY
    );
  });

  it("refuses a self-declared link", async () => {
    expect(await as(fresh).set("users/uid-new", signup({ isLinked: true }))).toBe(DENY);
    expect(
      await as(fresh).set("users/uid-new", signup({ employeeId: "emp-jo" }))
    ).toBe(DENY);
    expect(await as(fresh).set("users/uid-new", signup({ adminId: "adm-1" }))).toBe(
      DENY
    );
  });

  // The create rule reads each field through get() with a default precisely so
  // an absent key does not error out evaluation.
  it("accepts a document that omits the link fields entirely", async () => {
    expect(
      await as(fresh).set("users/uid-new", {
        fullName: "New Person",
        email: "new.person@example.com",
        role: "unassigned",
        isLinked: false,
      })
    ).toBe(ALLOW);
  });

  it("refuses a document that omits the role", async () => {
    // The default in the rule is '', which is not 'unassigned'.
    expect(
      await as(fresh).set("users/uid-new", { fullName: "X", isLinked: false })
    ).toBe(DENY);
  });

  it("refuses creating a user document under someone else's uid", async () => {
    expect(await as(fresh).set("users/uid-someone-else", signup())).toBe(DENY);
  });
});

describe("editing a user document", () => {
  it("lets a user change their own display fields", async () => {
    expect(await as(sam).update("users/uid-sam", { fullName: "Sam Renamed" })).toBe(
      ALLOW
    );
    expect(
      await as(sam).update("users/uid-sam", { profilePicture: "https://x/y.png" })
    ).toBe(ALLOW);
  });

  it("refuses a self-granted role", async () => {
    expect(await as(sam).update("users/uid-sam", { role: "admin" })).toBe(DENY);
  });

  it("refuses a self-granted link", async () => {
    expect(await as(sam).update("users/uid-sam", { adminId: "adm-1" })).toBe(DENY);
    // Asserted on the unlinked signup, not on Sam: `onlyChanges` compares
    // against the stored document, so `isLinked: true` on an already-linked
    // user changes no keys and the rule has nothing to refuse. The threat is an
    // unlinked account marking itself linked, which is a real change.
    expect(await as(nobody).update("users/uid-nobody", { isLinked: true })).toBe(DENY);
    expect(
      await as(nobody).update("users/uid-nobody", { employeeId: "emp-sam" })
    ).toBe(DENY);
  });

  // onlyChanges() is a hasOnly check, so smuggling a forbidden field alongside
  // a permitted one must fail rather than partially apply.
  it("refuses a permitted field bundled with a forbidden one", async () => {
    expect(
      await as(sam).update("users/uid-sam", { fullName: "Sam", role: "admin" })
    ).toBe(DENY);
  });

  it("refuses editing another user's document", async () => {
    expect(await as(jo).update("users/uid-sam", { fullName: "Hacked" })).toBe(DENY);
  });

  it("lets an admin change a role and a link", async () => {
    expect(
      await as(admin).update("users/uid-nobody", {
        role: "employee",
        isLinked: true,
        employeeId: "emp-new",
      })
    ).toBe(ALLOW);
  });
});

describe("reading user documents", () => {
  it("lets a user read their own", async () => {
    expect(await as(sam).get("users/uid-sam")).toBe(ALLOW);
  });

  it("lets an unlinked signup read their own", async () => {
    expect(await as(nobody).get("users/uid-nobody")).toBe(ALLOW);
  });

  it("refuses reading another user's", async () => {
    expect(await as(sam).get("users/uid-jo")).toBe(DENY);
  });

  it("lets an admin read any", async () => {
    expect(await as(admin).get("users/uid-sam")).toBe(ALLOW);
  });

  it("refuses listing every user to an employee", async () => {
    expect(await as(sam).query("users", "isLinked", false)).toBe(DENY);
  });
});

describe("deleting user documents", () => {
  it("refuses a user deleting their own", async () => {
    expect(await as(sam).remove("users/uid-sam")).toBe(DENY);
  });

  it("lets an admin delete one", async () => {
    expect(await as(admin).remove("users/uid-nobody")).toBe(ALLOW);
  });
});
