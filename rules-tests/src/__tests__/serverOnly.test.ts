/**
 * The collections no client may touch, plus the reference data everyone reads.
 *
 * Both are written only through the Admin SDK, which bypasses these rules
 * entirely. Each is denied to clients for a specific reason, and each reason is
 * a real attack if the rule is ever loosened:
 *
 * - `leaveBalanceAdjustments` — the audit trail for a figure that is money.
 * - `userClaims` — read-your-own, so the client can watch for a stale token.
 *
 * `mail` and `emailVerifications` were here too, until email verification was
 * dropped. An unmatched path denies by default, so those cases would still have
 * passed — which is exactly why they were removed rather than left: a test that
 * cannot fail says nothing about a collection that no longer exists.
 */

import { describe, it, expect, beforeEach } from "vitest";

import { ALLOW, DENY, as, seed, useEmulator } from "../harness";
import { admin, jo, nobody, sam, seedWorld } from "../fixtures";

useEmulator();
beforeEach(async () => {
  await seedWorld();
  await seed("leaveBalanceAdjustments/adj-1", {
    employeeId: "emp-sam",
    before: 15,
    after: 20,
    delta: 5,
    reason: "Carried over",
    adminUid: "uid-admin",
  });
  await seed("userClaims/uid-sam", { refreshTime: "2026-09-11T00:00:00Z" });
});

describe("the leave balance audit trail", () => {
  it("is readable by an admin", async () => {
    expect(await as(admin).get("leaveBalanceAdjustments/adj-1")).toBe(ALLOW);
  });

  it("is not readable by an employee", async () => {
    expect(await as(sam).get("leaveBalanceAdjustments/adj-1")).toBe(DENY);
  });

  // A record nobody can rewrite is the whole point of an audit trail.
  it("is not writable by anyone, admin included", async () => {
    expect(
      await as(admin).update("leaveBalanceAdjustments/adj-1", { reason: "Edited" })
    ).toBe(DENY);
    expect(await as(admin).remove("leaveBalanceAdjustments/adj-1")).toBe(DENY);
    expect(await as(sam).set("leaveBalanceAdjustments/adj-2", { delta: 100 })).toBe(
      DENY
    );
  });
});

describe("claim metadata", () => {
  it("lets a user watch their own refresh signal", async () => {
    expect(await as(sam).get("userClaims/uid-sam")).toBe(ALLOW);
  });

  it("refuses reading someone else's", async () => {
    expect(await as(jo).get("userClaims/uid-sam")).toBe(DENY);
  });

  it("refuses every client write", async () => {
    expect(await as(sam).update("userClaims/uid-sam", { refreshTime: "x" })).toBe(DENY);
    expect(await as(admin).update("userClaims/uid-sam", { refreshTime: "x" })).toBe(
      DENY
    );
  });
});

describe("reference data", () => {
  it("is readable by anyone signed in — it populates dropdowns", async () => {
    expect(await as(sam).get("leaveTypes/annual")).toBe(ALLOW);
    expect(await as(sam).get("equipmentCategories/laptop")).toBe(ALLOW);
    expect(await as(nobody).get("leaveTypes/annual")).toBe(ALLOW);
  });

  it("is writable only by an admin", async () => {
    expect(await as(sam).update("leaveTypes/annual", { defaultDays: 365 })).toBe(DENY);
    expect(await as(admin).update("leaveTypes/annual", { defaultDays: 25 })).toBe(
      ALLOW
    );
  });

  it("keeps admin records readable to all but writable by admins", async () => {
    expect(await as(sam).get("admins/adm-1")).toBe(ALLOW);
    expect(await as(sam).update("admins/adm-1", { fullName: "Hacked" })).toBe(DENY);
    expect(await as(admin).update("admins/adm-1", { fullName: "Alex A." })).toBe(ALLOW);
  });
});

describe("equipment", () => {
  it("lets an employee read the kit assigned to them", async () => {
    expect(await as(sam).get("equipment/kit-1")).toBe(ALLOW);
  });

  it("refuses an employee reading unassigned kit", async () => {
    expect(await as(sam).get("equipment/kit-2")).toBe(DENY);
  });

  it("refuses an employee assigning kit to themselves", async () => {
    expect(await as(sam).update("equipment/kit-2", { employeeId: "emp-sam" })).toBe(
      DENY
    );
  });

  it("lets an admin assign and unassign", async () => {
    expect(await as(admin).update("equipment/kit-2", { employeeId: "emp-sam" })).toBe(
      ALLOW
    );
    expect(await as(admin).update("equipment/kit-1", { employeeId: null })).toBe(ALLOW);
  });

  it("rejects a condition outside the enum", async () => {
    expect(await as(admin).update("equipment/kit-1", { condition: "broken" })).toBe(
      DENY
    );
    expect(await as(admin).update("equipment/kit-1", { condition: "used" })).toBe(
      ALLOW
    );
  });
});

describe("anything not matched by a rule", () => {
  it("is denied", async () => {
    expect(await as(admin).get("auditLogs/anything")).toBe(DENY);
    expect(await as(admin).set("auditLogs/anything", { x: 1 })).toBe(DENY);
  });
});
