/**
 * `settings/{settingId}` — wording an admin sets once for the whole organisation.
 *
 * Today that is only the leave policy. Every employee's leave screen reads it,
 * so the read has to work for anyone signed in, and the write has to stay with
 * admins: an employee who could write it could rewrite the policy for everyone.
 */

import { describe, it, expect, beforeEach } from "vitest";

import { ALLOW, DENY, as, seed, useEmulator } from "../harness";
import { admin, admin_beforeRefresh, nobody, sam, seedWorld } from "../fixtures";

const POLICY = "settings/leavePolicy";

useEmulator();
beforeEach(async () => {
  await seedWorld();
  await seed(POLICY, { text: "Book annual leave two weeks ahead." });
});

describe("reading the leave policy", () => {
  it("is open to an employee", async () => {
    expect(await as(sam).get(POLICY)).toBe(ALLOW);
  });

  it("is open to an admin", async () => {
    expect(await as(admin).get(POLICY)).toBe(ALLOW);
  });

  it("is open to anyone signed in, even before they are linked", async () => {
    expect(await as(nobody).get(POLICY)).toBe(ALLOW);
  });
});

describe("changing the leave policy", () => {
  it("is allowed for an admin", async () => {
    expect(await as(admin).set(POLICY, { text: "New wording." })).toBe(ALLOW);
  });

  it("is allowed for an admin whose claims have not arrived yet", async () => {
    expect(await as(admin_beforeRefresh).set(POLICY, { text: "New wording." })).toBe(ALLOW);
  });

  it("is denied to an employee", async () => {
    expect(await as(sam).set(POLICY, { text: "Unlimited leave for all." })).toBe(DENY);
  });

  it("is denied to someone not linked yet", async () => {
    expect(await as(nobody).set(POLICY, { text: "Unlimited leave for all." })).toBe(DENY);
  });

  it("must be text", async () => {
    expect(await as(admin).set(POLICY, { text: 42 })).toBe(DENY);
  });

  it("cannot be blank", async () => {
    expect(await as(admin).set(POLICY, { text: "" })).toBe(DENY);
  });

  it("cannot be done by deleting it, even for an admin", async () => {
    expect(await as(admin).remove(POLICY)).toBe(DENY);
  });
});

describe("other settings", () => {
  it("cannot be created, even by an admin", async () => {
    expect(await as(admin).set("settings/anythingElse", { text: "x" })).toBe(DENY);
  });
});
