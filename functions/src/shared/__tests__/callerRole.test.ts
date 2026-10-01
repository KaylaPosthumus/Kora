import { describe, it, expect, vi } from "vitest";

import { isCallerAdmin } from "../callerRole";

/** A document reader that records whether it was consulted. */
const reader = (role: unknown) => vi.fn(async () => role);

describe("isCallerAdmin", () => {
  it("accepts an admin claim", async () => {
    expect(await isCallerAdmin("admin", reader("unassigned"))).toBe(true);
  });

  // The claim is the fast path; a hit must not cost a document read.
  it("does not read the user document when the claim already says admin", async () => {
    const readDocRole = reader("admin");
    await isCallerAdmin("admin", readDocRole);
    expect(readDocRole).not.toHaveBeenCalled();
  });

  // The rules OR the two sources, so a stale token must not lock out an admin
  // who was promoted since their last token refresh.
  it("accepts an admin user document despite a stale non-admin claim", async () => {
    expect(await isCallerAdmin("employee", reader("admin"))).toBe(true);
  });

  it("accepts an admin user document when there is no claim at all", async () => {
    expect(await isCallerAdmin(undefined, reader("admin"))).toBe(true);
  });

  it("rejects a caller who is admin by neither source", async () => {
    expect(await isCallerAdmin("employee", reader("employee"))).toBe(false);
  });

  it("rejects a caller with no claim and no user document", async () => {
    expect(await isCallerAdmin(undefined, reader(undefined))).toBe(false);
  });

  it("rejects an unassigned signup", async () => {
    expect(await isCallerAdmin("unassigned", reader("unassigned"))).toBe(false);
  });

  // Guarding the boundary the whole rule set rests on.
  it.each([
    ["a numeric role from the old .NET contract", 2],
    ["a lookalike string", "Admin"],
    ["an array", ["admin"]],
    ["an object", { role: "admin" }],
    ["true", true],
    ["null", null],
  ])("does not grant admin from %s in the claim", async (_label, tokenRole) => {
    expect(await isCallerAdmin(tokenRole, reader("employee"))).toBe(false);
  });

  it.each([
    ["a numeric role", 2],
    ["a lookalike string", "Admin"],
    ["true", true],
  ])("does not grant admin from %s in the document", async (_label, docRole) => {
    expect(await isCallerAdmin(undefined, reader(docRole))).toBe(false);
  });

  it("falls back to the document exactly once", async () => {
    const readDocRole = reader("admin");
    await isCallerAdmin(undefined, readDocRole);
    expect(readDocRole).toHaveBeenCalledTimes(1);
  });
});
