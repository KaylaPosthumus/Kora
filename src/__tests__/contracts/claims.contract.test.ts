/**
 * Custom claims, across all three packages.
 *
 * `syncRoleClaim` and `onEmployeeSuspensionChanged` write claims in `functions/`,
 * `firestore.rules` authorises on them, and `AuthContext` refreshes the token that
 * carries them. Three artifacts, three separate suites, no shared declaration —
 * so a claim renamed on one side is caught by none of them.
 *
 * The dot-access rule below is the one that matters. `request.auth.token.role` on a
 * token without that claim is an *evaluation error* in the rules language, not a
 * null — and an error denies. That shipped once and denied every employee write in
 * production; `claim(key, default)` exists to prevent it. A rules test proves the
 * helper behaves, but only reading the rules text proves nobody reintroduced dot
 * access somewhere else.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { MANAGED_CLAIMS } from "../../../functions/src/claims/roleClaims";
import { SUSPENDED_CLAIM } from "../../../functions/src/claims/suspensionClaim";

const rules = readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8");
const allClaims = [...MANAGED_CLAIMS, SUSPENDED_CLAIM];

/** Claims the rules actually authorise on. */
const claimsReadByRules = [...(rules.match(/claim\(\s*'(\w+)'/g) ?? [])].map(
  (hit) => hit.replace(/claim\(\s*'/, "").replace("'", "")
);

describe("the rules never authorise on a claim nothing writes", () => {
  // This is the dangerous direction. A rule reading a claim the backend never
  // mints does not error — `claim(key, default)` returns the default — so the
  // rule silently takes its fallback branch and the failure looks like a
  // permissions bug months later.
  it.each([...new Set(claimsReadByRules)])("%s is written by the backend", (key) => {
    expect(allClaims).toContain(key);
  });
});

describe("claims the backend writes but nothing reads", () => {
  // The harmless direction, asserted anyway because it is dead weight on every
  // token: claims ride on every request, and `suspensionClaim.ts` already keeps
  // itself absent-unless-true for exactly that reason.
  //
  // `adminId` is currently the only one. The rules authorise admins through
  // `claim('role') == 'admin'`, and the client reads adminId off the user
  // document rather than the token — so nothing reads the claim at all. Left in
  // place deliberately; if it is ever removed, drop it from this list.
  const knownUnread = ["adminId"];

  it("has no unread claims beyond the ones recorded here", () => {
    const unread = allClaims.filter((key) => !claimsReadByRules.includes(key));
    expect(unread.sort()).toEqual(knownUnread.sort());
  });
});

describe("the rules never read a claim by dot access", () => {
  it.each(allClaims)("does not dot-access %s", (key) => {
    // `request.auth.token.<key>` — the form that errors on an absent claim.
    expect(rules).not.toMatch(new RegExp(`request\\.auth\\.token\\.${key}\\b`));
  });

  it("reaches the token only through claim() or .get()", () => {
    const direct = rules.match(/request\.auth\.token\.(\w+)/g) ?? [];
    const allowed = direct.filter((hit) => hit.endsWith(".get"));
    expect(direct.filter((hit) => !allowed.includes(hit))).toEqual([]);
  });
});

describe("the claim-refresh channel", () => {
  const syncRoleClaim = readFileSync(
    resolve(process.cwd(), "functions/src/claims/syncRoleClaim.ts"),
    "utf8"
  );
  const authContext = readFileSync(
    resolve(process.cwd(), "src/contexts/AuthContext.tsx"),
    "utf8"
  );

  it("writes and watches the same collection", () => {
    // A claim does not reach the client until its ID token refreshes, so the
    // function stamps a document the client watches. If these two names drift,
    // nothing errors — the client simply waits up to an hour for a stale role.
    expect(syncRoleClaim).toContain("userClaims");
    expect(authContext).toContain("userClaims");
  });

  it("writes and watches the same field", () => {
    expect(syncRoleClaim).toContain("refreshTime");
    expect(authContext).toContain("refreshTime");
  });

  it("keeps that document readable by its own subject", () => {
    expect(rules).toMatch(/match \/userClaims\/\{/);
  });
});
