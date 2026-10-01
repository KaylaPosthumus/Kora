/**
 * Reading custom claims: the absent-claim cases.
 *
 * This file is the regression suite for two bugs that were live in production.
 * Both came from the same mistake — reading a custom claim by dot access —
 * and neither was reachable by any test that did not run the real rules engine:
 *
 * 1. `notSuspended()` read `request.auth.token.suspended`. Absent for everyone
 *    who has never been suspended, and an absent key on a rules map is an
 *    *evaluation error*, not a null. Every employee write was denied.
 *
 * 2. `isAdmin()` read `request.auth.token.role`. When a token carries no custom
 *    claims at all, that error aborted the whole `||` expression before the
 *    `exists()` / `get()` fallback could run. The fallback CLAUDE.md describes
 *    as load-bearing — "the claim is the fast path, not the only one" — was
 *    unreachable, so a just-linked user could do nothing until their token
 *    happened to refresh.
 *
 * The fix is `request.auth.token.get(key, default)`, wrapped as `claim()`.
 */

import { describe, it, expect, beforeEach } from "vitest";

import { ALLOW, DENY, as, useEmulator } from "../harness";
import {
  admin,
  admin_beforeRefresh,
  leaveRequest,
  sam,
  sam_beforeRefresh,
  sam_suspended,
  seedWorld,
} from "../fixtures";

useEmulator();
beforeEach(seedWorld);

describe("an absent `suspended` claim", () => {
  // The bug: this denied every employee write in production.
  it("does not block an employee who has never been suspended", async () => {
    expect(await as(sam).set("leaveRequests/new", leaveRequest())).toBe(ALLOW);
  });

  it("does not block an employee editing their own profile", async () => {
    expect(
      await as(sam).update("users/uid-sam", { fullName: "Sam Renamed" })
    ).toBe(ALLOW);
  });

  it("does not block an employee editing their own employee record", async () => {
    expect(
      await as(sam).update("employees/emp-sam", { phoneNumber: "0123456789" })
    ).toBe(ALLOW);
  });

  // The claim is never written as `false` — nextSuspensionClaims deletes the
  // key on reinstatement — but a token minted before that was true should
  // behave identically to one with no key at all.
  it("behaves the same as an explicit suspended: false", async () => {
    const reinstated = { uid: "uid-sam", claims: { ...sam.claims, suspended: false } };
    expect(await as(reinstated).set("leaveRequests/new", leaveRequest())).toBe(ALLOW);
  });

  it("still blocks an employee who IS suspended", async () => {
    expect(await as(sam_suspended).set("leaveRequests/new", leaveRequest())).toBe(DENY);
  });
});

describe("a token with no custom claims at all", () => {
  // The state of every freshly-linked account until syncRoleClaim lands AND
  // the client's ID token refreshes — up to an hour on its own.
  it("falls back to the user document for an employee", async () => {
    expect(await as(sam_beforeRefresh).set("leaveRequests/new", leaveRequest())).toBe(
      ALLOW
    );
  });

  it("falls back to the user document for an admin", async () => {
    expect(
      await as(admin_beforeRefresh).update("employees/emp-sam", { salaryAmount: 111 })
    ).toBe(ALLOW);
  });

  it("lets an employee read their own record through the fallback", async () => {
    expect(await as(sam_beforeRefresh).get("employees/emp-sam")).toBe(ALLOW);
  });

  // The fallback must resolve the *real* role, not merely stop erroring.
  it("does not turn an unlinked user into an admin", async () => {
    const stranger = { uid: "uid-nobody" };
    expect(await as(stranger).update("employees/emp-sam", { salaryAmount: 1 })).toBe(
      DENY
    );
    expect(await as(stranger).get("employees/emp-sam")).toBe(DENY);
  });

  // A uid with no user document at all: exists() is false, so the fallback has
  // nothing to read. It must deny rather than error into an allow.
  it("denies a signed-in uid with no user document", async () => {
    const ghost = { uid: "uid-ghost" };
    expect(await as(ghost).get("employees/emp-sam")).toBe(DENY);
    expect(await as(ghost).set("leaveRequests/new", leaveRequest())).toBe(DENY);
  });
});

describe("the claim and the document as alternatives", () => {
  // callerRole.ts documents this deliberately: they are alternatives, not a
  // precedence order. A promoted admin is an admin by the document before
  // their token catches up.
  it("admits an admin whose token still says employee", async () => {
    const promoted = { uid: "uid-admin", claims: { role: "employee" } };
    expect(
      await as(promoted).update("employees/emp-sam", { salaryAmount: 222 })
    ).toBe(ALLOW);
  });

  // The same `||` in the other direction: the claim alone is enough, which is
  // what makes the claim a genuine fast path rather than an optimisation the
  // rules ignore.
  it("admits an admin whose claim is set before any document exists", async () => {
    const claimOnly = { uid: "uid-fresh-admin", claims: { role: "admin" } };
    expect(
      await as(claimOnly).update("employees/emp-sam", { salaryAmount: 333 })
    ).toBe(ALLOW);
  });
});

describe("employeeId resolution", () => {
  it("resolves from the claim when present", async () => {
    expect(await as(sam).get("employees/emp-sam")).toBe(ALLOW);
  });

  it("resolves from the user document when the claim is absent", async () => {
    expect(await as(sam_beforeRefresh).get("employees/emp-sam")).toBe(ALLOW);
  });

  // A claim naming someone else's employee record must not open it. The claim
  // is minted by syncRoleClaim from the user document, so this is really a test
  // that the rules compare rather than merely read.
  it("does not let one employee reach another's record either way", async () => {
    expect(await as(sam).get("employees/emp-jo")).toBe(DENY);
    expect(await as(sam_beforeRefresh).get("employees/emp-jo")).toBe(DENY);
  });
});

describe("the admin control cases", () => {
  it("lets an admin with a role claim through", async () => {
    expect(await as(admin).set("leaveRequests/new", leaveRequest())).toBe(ALLOW);
  });

  it("lets an admin read any employee", async () => {
    expect(await as(admin).get("employees/emp-jo")).toBe(ALLOW);
  });
});
