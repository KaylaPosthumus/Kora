import { describe, it, expect } from "vitest";

import {
  CODE_TTL_MS,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_MS,
  canResend,
  evaluateAttempt,
  generateCode,
  hashCode,
  issueChallenge,
  isWellFormedCode,
  resendWaitSeconds,
  type Challenge,
} from "../verificationCode";

const NOW = Date.UTC(2026, 8, 7, 12, 0, 0);

describe("generateCode", () => {
  it("always produces exactly six digits", () => {
    for (let run = 0; run < 500; run += 1) {
      expect(generateCode()).toMatch(/^\d{6}$/);
    }
  });

  // The common shortcut (`Math.floor(Math.random() * 900000) + 100000`) cannot
  // produce a code starting with 0, quietly throwing away a tenth of the space.
  it("can produce codes that start with zero", () => {
    const codes = Array.from({ length: 3000 }, generateCode);
    expect(codes.some((code) => code.startsWith("0"))).toBe(true);
  });

  it("covers the full range including the endpoints' neighbourhoods", () => {
    const codes = Array.from({ length: 3000 }, generateCode).map(Number);
    expect(Math.min(...codes)).toBeLessThan(100_000);
    expect(Math.max(...codes)).toBeGreaterThan(900_000);
  });

  it("does not repeat itself constantly", () => {
    const codes = new Set(Array.from({ length: 200 }, generateCode));
    expect(codes.size).toBeGreaterThan(150);
  });
});

describe("hashCode", () => {
  it("is deterministic for the same uid and code", () => {
    expect(hashCode("uid1", "012345")).toBe(hashCode("uid1", "012345"));
  });

  // The salt is why a hash lifted from one user's challenge cannot be replayed
  // against another user who happened to get the same code.
  it("differs across users given the same code", () => {
    expect(hashCode("uid1", "012345")).not.toBe(hashCode("uid2", "012345"));
  });

  it("differs across codes for the same user", () => {
    expect(hashCode("uid1", "012345")).not.toBe(hashCode("uid1", "012346"));
  });

  it("never contains the code itself", () => {
    expect(hashCode("uid1", "012345")).not.toContain("012345");
  });

  it("produces a fixed-length hex digest", () => {
    expect(hashCode("uid1", "000000")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("isWellFormedCode", () => {
  it.each([
    ["six digits", "123456", true],
    ["six digits starting with zero", "012345", true],
    ["five digits", "12345", false],
    ["seven digits", "1234567", false],
    ["letters", "12a456", false],
    ["empty", "", false],
    ["whitespace padded", " 123456 ", false],
    ["a number rather than a string", 123456, false],
    ["null", null, false],
    ["undefined", undefined, false],
  ])("treats %s as %s", (_label, input, expected) => {
    expect(isWellFormedCode(input)).toBe(expected);
  });
});

describe("issueChallenge", () => {
  it("stores the hash rather than the code", () => {
    const { challenge, code } = issueChallenge("uid1", NOW);

    expect(challenge.codeHash).toBe(hashCode("uid1", code));
    expect(JSON.stringify(challenge)).not.toContain(code);
  });

  it("starts with a clean attempt count and the full window", () => {
    const { challenge } = issueChallenge("uid1", NOW);

    expect(challenge.attempts).toBe(0);
    expect(challenge.sentAt).toBe(NOW);
    expect(challenge.expiresAt).toBe(NOW + CODE_TTL_MS);
  });

  it("returns a code that immediately verifies", () => {
    const { challenge, code } = issueChallenge("uid1", NOW);

    expect(evaluateAttempt("uid1", challenge, code, NOW)).toEqual({ status: "ok" });
  });
});

describe("evaluateAttempt", () => {
  const fresh = (overrides: Partial<Challenge> = {}): Challenge => ({
    ...issueChallenge("uid1", NOW).challenge,
    ...overrides,
  });

  it("accepts the right code inside the window", () => {
    const { challenge, code } = issueChallenge("uid1", NOW);

    expect(evaluateAttempt("uid1", challenge, code, NOW + 1000)).toEqual({ status: "ok" });
  });

  it("reports no-challenge when nothing was issued", () => {
    expect(evaluateAttempt("uid1", undefined, "123456", NOW)).toEqual({
      status: "no-challenge",
    });
  });

  it("rejects a wrong code and counts down the remaining attempts", () => {
    const { challenge, code } = issueChallenge("uid1", NOW);
    const wrong = code === "000000" ? "111111" : "000000";

    expect(evaluateAttempt("uid1", challenge, wrong, NOW)).toEqual({
      status: "wrong-code",
      attemptsRemaining: MAX_ATTEMPTS - 1,
    });
  });

  it("reports zero remaining on the last allowed guess", () => {
    const { challenge, code } = issueChallenge("uid1", NOW);
    const wrong = code === "000000" ? "111111" : "000000";
    const nearlySpent = { ...challenge, attempts: MAX_ATTEMPTS - 1 };

    expect(evaluateAttempt("uid1", nearlySpent, wrong, NOW)).toEqual({
      status: "wrong-code",
      attemptsRemaining: 0,
    });
  });

  it("refuses once the attempt budget is spent", () => {
    const { challenge, code } = issueChallenge("uid1", NOW);
    const spent = { ...challenge, attempts: MAX_ATTEMPTS };

    // Even the correct code is refused — the budget is the point.
    expect(evaluateAttempt("uid1", spent, code, NOW)).toEqual({
      status: "too-many-attempts",
    });
  });

  it("refuses a code at the moment it expires", () => {
    const { challenge, code } = issueChallenge("uid1", NOW);

    expect(evaluateAttempt("uid1", challenge, code, NOW + CODE_TTL_MS)).toEqual({
      status: "expired",
    });
  });

  it("still accepts a code one millisecond before expiry", () => {
    const { challenge, code } = issueChallenge("uid1", NOW);

    expect(evaluateAttempt("uid1", challenge, code, NOW + CODE_TTL_MS - 1)).toEqual({
      status: "ok",
    });
  });

  // A spent budget must win over expiry, so a caller cannot keep resending
  // against a code someone is brute-forcing.
  it("reports a spent budget ahead of expiry", () => {
    const spentAndExpired = fresh({ attempts: MAX_ATTEMPTS });

    expect(
      evaluateAttempt("uid1", spentAndExpired, "123456", NOW + CODE_TTL_MS + 1)
    ).toEqual({ status: "too-many-attempts" });
  });

  it("rejects a malformed submission without spending the guess budget silently", () => {
    const { challenge } = issueChallenge("uid1", NOW);

    expect(evaluateAttempt("uid1", challenge, "abc", NOW)).toEqual({ status: "malformed" });
  });

  // The salt in the hash is what makes this hold.
  it("refuses another user's code even when the challenge is valid", () => {
    const { code } = issueChallenge("uid1", NOW);
    const otherChallenge = issueChallenge("uid2", NOW).challenge;

    expect(evaluateAttempt("uid2", otherChallenge, code, NOW).status).not.toBe("ok");
  });
});

describe("resend throttling", () => {
  it("allows a send when nothing has been issued", () => {
    expect(canResend(undefined, NOW)).toBe(true);
    expect(resendWaitSeconds(undefined, NOW)).toBe(0);
  });

  it("blocks a resend inside the cooldown", () => {
    const { challenge } = issueChallenge("uid1", NOW);

    expect(canResend(challenge, NOW + 1000)).toBe(false);
  });

  it("allows a resend once the cooldown has elapsed", () => {
    const { challenge } = issueChallenge("uid1", NOW);

    expect(canResend(challenge, NOW + RESEND_COOLDOWN_MS)).toBe(true);
  });

  it("reports the whole-second wait remaining", () => {
    const { challenge } = issueChallenge("uid1", NOW);

    expect(resendWaitSeconds(challenge, NOW + 30_000)).toBe(30);
    // Rounds up, so a caller told to wait n seconds never comes back too early.
    expect(resendWaitSeconds(challenge, NOW + 30_500)).toBe(30);
    expect(resendWaitSeconds(challenge, NOW + 29_500)).toBe(31);
  });

  it("reports no wait once the cooldown has passed", () => {
    const { challenge } = issueChallenge("uid1", NOW);

    expect(resendWaitSeconds(challenge, NOW + RESEND_COOLDOWN_MS + 5000)).toBe(0);
  });
});
