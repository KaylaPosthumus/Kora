/**
 * Collection names, across the client, the rules and the triggers.
 *
 * Firestore creates a collection on first write, so a typo is not an error — it
 * is a new, empty, rule-less collection. The client writes happily, the rules
 * match nothing (default deny, or worse, a `{path=**}` that does match), and the
 * trigger listening on the correct name never fires.
 *
 * Nothing in the three suites catches that: the app's fake Firestore accepts any
 * path, the rules tests seed the paths they assert on, and the functions tests
 * inject their own backend.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

const firestoreLib = read("src/shared/lib/firestore.ts");
const rules = read("firestore.rules");

/** Every `collection(db, "x")` the client declares. */
const clientCollections = [...firestoreLib.matchAll(/collection\(db,\s*"(\w+)"\)/g)].map(
  (m) => m[1]
);

/** Every top-level `match /x/{...}` the rules define. */
const ruleCollections = [...rules.matchAll(/match \/(\w+)\/\{/g)].map((m) => m[1]);

describe("the client and the rules agree on every collection", () => {
  it("declares the collections the data layer actually uses", () => {
    // A guard on the guard: if the regex stops matching, every assertion below
    // passes vacuously.
    expect(clientCollections.length).toBeGreaterThanOrEqual(9);
  });

  it.each([...new Set(clientCollections)])("%s has a rule", (name) => {
    expect(ruleCollections).toContain(name);
  });

  it("covers the leaveBalances subcollection and its collection-group read", () => {
    // Its document id *is* the leave type id — the invariant the approve-and-
    // decrement transaction depends on. Both the nested match and the
    // collection-group match have to exist.
    expect(firestoreLib).toContain('"leaveBalances"');
    expect(rules).toMatch(/match \/leaveBalances\/\{leaveTypeId\}/);
    expect(rules).toMatch(/match \/\{path=\*\*\}\/leaveBalances\/\{/);
  });
});

describe("the triggers listen on collections that exist", () => {
  const triggerPaths = [
    ["functions/src/claims/syncRoleClaim.ts", "users"],
    ["functions/src/employees/onEmployeeDeleted.ts", "employees"],
    ["functions/src/employees/onEmployeeSuspensionChanged.ts", "employees"],
    ["functions/src/admins/onAdminDeleted.ts", "admins"],
    ["functions/src/equipment/onEquipmentCategoryWritten.ts", "equipmentCategories"],
    ["functions/src/profile/onUserProfileWritten.ts", "users"],
    ["functions/src/profile/onEmployeeProfileWritten.ts", "employees"],
    ["functions/src/profile/onAdminProfileWritten.ts", "admins"],
    ["functions/src/leave/onLeaveTypeWritten.ts", "leaveTypes"],
    ["functions/src/leave/onLeaveRequestWritten.ts", "leaveRequests"],
  ] as const;

  it.each(triggerPaths)("%s watches %s, which the client writes", (file, collection) => {
    expect(read(file)).toContain(collection);
    expect(clientCollections).toContain(collection);
  });
});

describe("server-only collections stay out of the client", () => {
  const serverOnly = ["leaveBalanceAdjustments", "userClaims"];

  it.each(serverOnly)("%s has a rule but no client collection ref", (name) => {
    expect(ruleCollections).toContain(name);
    // The client may *read* userClaims through a doc() watch, but neither is a
    // collection the data layer writes through.
    expect(clientCollections).not.toContain(name);
  });
});
