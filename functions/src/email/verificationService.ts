/**
 * Requesting and confirming an email verification code.
 *
 * The decisions live here behind a {@link VerificationBackend}; the callables in
 * `verifyEmail.ts` supply an Admin SDK implementation and a test supplies fakes.
 */

import {
  CODE_TTL_MS,
  MAX_ATTEMPTS,
  canResend,
  evaluateAttempt,
  issueChallenge,
  resendWaitSeconds,
  type Challenge,
} from "./verificationCode";
import { verificationEmail, type MailDocument } from "./mail";

/** The account fields verification cares about. */
export interface AccountSummary {
  email?: string;
  displayName?: string;
  emailVerified: boolean;
}

export interface VerificationBackend {
  /** The auth account for a uid, or undefined if there is none. */
  readAccount(uid: string): Promise<AccountSummary | undefined>;
  readChallenge(uid: string): Promise<Challenge | undefined>;
  writeChallenge(uid: string, challenge: Challenge): Promise<void>;
  deleteChallenge(uid: string): Promise<void>;
  /** Persists a bumped attempt count after a wrong guess. */
  recordAttempts(uid: string, attempts: number): Promise<void>;
  /** Flips Firebase Auth's own `emailVerified` flag. */
  markVerified(uid: string): Promise<void>;
  enqueueMail(mail: MailDocument): Promise<void>;
}

export type RequestOutcome =
  | { status: "sent"; expiresInSeconds: number }
  /** Nothing to do — the address is already confirmed. */
  | { status: "already-verified" }
  | { status: "cooldown"; retryAfterSeconds: number }
  /** The account has no email address (a Google sign-in edge case). */
  | { status: "no-email" }
  | { status: "no-account" };

/**
 * Issues a code and queues the email.
 *
 * Returns rather than throws for every expected outcome, so the callable can
 * map them to a result the client branches on instead of parsing error strings.
 */
export const requestVerification = async (
  uid: string,
  backend: VerificationBackend,
  now: number
): Promise<RequestOutcome> => {
  const account = await backend.readAccount(uid);
  if (account === undefined) return { status: "no-account" };
  if (account.emailVerified) return { status: "already-verified" };
  if (!account.email) return { status: "no-email" };

  const existing = await backend.readChallenge(uid);
  if (!canResend(existing, now)) {
    return { status: "cooldown", retryAfterSeconds: resendWaitSeconds(existing, now) };
  }

  const { challenge, code } = issueChallenge(uid, now);

  // The challenge is stored before the mail is queued: a code that reaches the
  // user's inbox but was never persisted would be unverifiable, whereas a
  // stored code whose email failed can simply be resent.
  await backend.writeChallenge(uid, challenge);
  await backend.enqueueMail(
    verificationEmail(account.email, code, CODE_TTL_MS / 60_000, account.displayName)
  );

  return { status: "sent", expiresInSeconds: CODE_TTL_MS / 1000 };
};

export type ConfirmOutcome =
  | { status: "verified" }
  | { status: "already-verified" }
  | { status: "no-account" }
  | { status: "no-challenge" }
  | { status: "expired" }
  | { status: "too-many-attempts" }
  | { status: "malformed" }
  | { status: "wrong-code"; attemptsRemaining: number };

/**
 * Checks a submitted code and, if it matches, marks the address verified.
 *
 * A correct code consumes its challenge, so it cannot be replayed. A wrong one
 * spends an attempt — persisted before returning, or the budget could be evaded
 * by abandoning each request partway.
 */
export const confirmVerification = async (
  uid: string,
  submitted: unknown,
  backend: VerificationBackend,
  now: number
): Promise<ConfirmOutcome> => {
  const account = await backend.readAccount(uid);
  if (account === undefined) return { status: "no-account" };
  if (account.emailVerified) {
    // Clear any outstanding challenge so a stale code cannot linger against an
    // account that no longer needs one.
    await backend.deleteChallenge(uid);
    return { status: "already-verified" };
  }

  const challenge = await backend.readChallenge(uid);
  const outcome = evaluateAttempt(uid, challenge, submitted, now);

  switch (outcome.status) {
    case "ok":
      await backend.markVerified(uid);
      await backend.deleteChallenge(uid);
      return { status: "verified" };

    case "wrong-code":
      await backend.recordAttempts(uid, (challenge?.attempts ?? 0) + 1);
      return outcome;

    // A malformed submission is a client bug, not a guess, so it does not spend
    // the budget — otherwise a broken input mask could lock a user out.
    case "malformed":
      return { status: "malformed" };

    default:
      return outcome;
  }
};

export { MAX_ATTEMPTS };
