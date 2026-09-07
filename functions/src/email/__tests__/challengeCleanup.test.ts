import { describe, it, expect } from "vitest";

import {
  RETENTION_AFTER_EXPIRY_MS,
  cleanupCutoff,
  isCleanable,
} from "../challengeCleanup";
import { CODE_TTL_MS, issueChallenge } from "../verificationCode";

const NOW = Date.UTC(2026, 8, 7, 12, 0, 0);

describe("cleanupCutoff", () => {
  it("sits one retention window behind now", () => {
    expect(cleanupCutoff(NOW)).toBe(NOW - RETENTION_AFTER_EXPIRY_MS);
  });
});

describe("isCleanable", () => {
  const { challenge } = issueChallenge("uid1", NOW);

  it("keeps a live challenge", () => {
    expect(isCleanable(challenge, NOW)).toBe(false);
  });

  // The grace period is what keeps "expired" distinguishable from
  // "no-challenge", which are different messages to the user.
  it("keeps a just-expired challenge through the grace period", () => {
    expect(isCleanable(challenge, NOW + CODE_TTL_MS + 1000)).toBe(false);
  });

  it("keeps a challenge right up to the end of the grace period", () => {
    expect(isCleanable(challenge, challenge.expiresAt + RETENTION_AFTER_EXPIRY_MS)).toBe(
      false
    );
  });

  it("retires a challenge once the grace period has passed", () => {
    expect(
      isCleanable(challenge, challenge.expiresAt + RETENTION_AFTER_EXPIRY_MS + 1)
    ).toBe(true);
  });

  it("retires a long-abandoned challenge", () => {
    expect(isCleanable(challenge, NOW + 30 * 24 * 60 * 60 * 1000)).toBe(true);
  });

  // A malformed document should not be swept up on a guess about its age.
  it.each([
    ["a missing expiry", {}],
    ["a non-numeric expiry", { expiresAt: "soon" }],
    ["a null expiry", { expiresAt: null }],
  ])("keeps a challenge with %s", (_label, doc) => {
    expect(isCleanable(doc as { expiresAt: number }, NOW + 1e12)).toBe(false);
  });
});
