/**
 * The 6-digit email verification code, rebuilt from CoriCore's Email API.
 *
 * The ER diagram shows the original design: `User.VerificationCode` and
 * `User.CodeGeneratedAt`, so a short code with an expiry window. Two things are
 * deliberately different here:
 *
 * - **The code is stored hashed, never in plaintext.** CoriCore kept it as a
 *   `STRING` on the user row. Anyone who could read a user document could read
 *   the live code; in this app `firestore.rules` lets an admin read every user
 *   document, so plaintext would make every admin able to complete anyone's
 *   verification.
 * - **Verification happens after account creation, not before it.** CoriCore
 *   gated `register-verified` on the code. Firebase Auth creates the account
 *   client-side via `createUserWithEmailAndPassword`, and reproducing the old
 *   ordering would mean posting the user's password to a function so it could
 *   call `createUser` itself. Confirming afterwards and flipping Firebase's own
 *   `emailVerified` flag keeps the client SDK flow intact — and `isVerified` on
 *   `CurrentUserDTO` already reads that flag, so nothing on the frontend changes.
 *
 * Everything here is pure apart from {@link generateCode}, which needs entropy.
 */

import { createHash, randomInt, timingSafeEqual } from "node:crypto";

/** How long a code stays usable. */
export const CODE_TTL_MS = 10 * 60 * 1000;

/** Wrong guesses allowed before the code is burned. */
export const MAX_ATTEMPTS = 5;

/** Minimum wait between sends, so the endpoint cannot be used to spam an inbox. */
export const RESEND_COOLDOWN_MS = 60 * 1000;

/** The stored challenge. Lives at `emailVerifications/{uid}`, unreadable by clients. */
export interface Challenge {
  /** `sha256(uid + code)` — never the code itself. */
  codeHash: string;
  /** Epoch ms after which the code is refused. */
  expiresAt: number;
  /** Wrong guesses so far. */
  attempts: number;
  /** Epoch ms the code was issued, for the resend cooldown. */
  sentAt: number;
}

/**
 * A uniformly random 6-digit code, zero-padded.
 *
 * `randomInt` rather than `Math.random`: this is a credential, and `Math.random`
 * is neither uniform across the range nor unpredictable. Padding matters —
 * `Math.floor(Math.random() * 900000) + 100000` is the usual shortcut and it
 * silently makes codes starting with 0 impossible, costing a tenth of the space.
 */
export const generateCode = (): string => String(randomInt(0, 1_000_000)).padStart(6, "0");

/**
 * Hashes a code for storage.
 *
 * Salted with the uid so the same code issued to two users does not produce the
 * same hash, and a hash lifted from one document cannot be replayed against
 * another. A fast hash is the right choice here rather than bcrypt/scrypt: the
 * input is high-enough entropy for a 10-minute, 5-attempt window, and this runs
 * on every verification attempt.
 */
export const hashCode = (uid: string, code: string): string =>
  createHash("sha256").update(`${uid}:${code}`).digest("hex");

/** Constant-time hex comparison, so a wrong guess leaks nothing through timing. */
const hashesMatch = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
};

/** Whether a submitted string could be a code at all. */
export const isWellFormedCode = (code: unknown): code is string =>
  typeof code === "string" && /^\d{6}$/.test(code);

export type AttemptOutcome =
  | { status: "ok" }
  /** Nothing was ever issued, or it has already been consumed. */
  | { status: "no-challenge" }
  /** The guess budget is spent; the code is dead even if the next guess is right. */
  | { status: "too-many-attempts" }
  | { status: "expired" }
  | { status: "malformed" }
  | { status: "wrong-code"; attemptsRemaining: number };

/**
 * Judges one verification attempt.
 *
 * The attempt budget is checked before expiry on purpose: a spent budget is a
 * security state, and reporting it as merely "expired" would invite a caller to
 * keep resending against a code that is being brute-forced. Both outcomes lead
 * the user to the same remedy — request a new code.
 *
 * @param now epoch ms, injected so expiry is testable without faking the clock
 */
export const evaluateAttempt = (
  uid: string,
  challenge: Challenge | undefined,
  submitted: unknown,
  now: number
): AttemptOutcome => {
  if (challenge === undefined) return { status: "no-challenge" };
  if (challenge.attempts >= MAX_ATTEMPTS) return { status: "too-many-attempts" };
  if (now >= challenge.expiresAt) return { status: "expired" };
  if (!isWellFormedCode(submitted)) return { status: "malformed" };

  if (hashesMatch(hashCode(uid, submitted), challenge.codeHash)) return { status: "ok" };

  return {
    status: "wrong-code",
    attemptsRemaining: Math.max(0, MAX_ATTEMPTS - (challenge.attempts + 1)),
  };
};

/** A fresh challenge for `uid`, and the plaintext code to email. */
export const issueChallenge = (
  uid: string,
  now: number
): { challenge: Challenge; code: string } => {
  const code = generateCode();
  return {
    code,
    challenge: {
      codeHash: hashCode(uid, code),
      expiresAt: now + CODE_TTL_MS,
      attempts: 0,
      sentAt: now,
    },
  };
};

/**
 * Whether a resend is allowed yet.
 *
 * Absent or already-expired challenges are always resendable — the cooldown
 * exists to throttle an inbox, not to lock a user out of a code they never got.
 */
export const canResend = (challenge: Challenge | undefined, now: number): boolean =>
  challenge === undefined || now - challenge.sentAt >= RESEND_COOLDOWN_MS;

/** Seconds a caller must wait before another send. 0 when it may send now. */
export const resendWaitSeconds = (challenge: Challenge | undefined, now: number): number => {
  if (canResend(challenge, now)) return 0;
  return Math.ceil((challenge!.sentAt + RESEND_COOLDOWN_MS - now) / 1000);
};
