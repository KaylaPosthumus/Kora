/**
 * Retiring email verification challenges that are no longer usable.
 *
 * `emailVerifications/{uid}` documents are written on every code request and
 * deleted on success, but a code the user never used stays forever.
 * `onUserDeleted` clears them for accounts that go away; nothing clears them for
 * accounts that stay. They are small, but they are a slowly growing pile of
 * credential material — hashed, but still — and nothing reads them once expired.
 *
 * A grace period is kept after expiry on purpose. `evaluateAttempt` distinguishes
 * "expired" from "no-challenge", and only the first tells a user their code
 * timed out and to request another. Deleting the moment a code expires would
 * turn that into the vaguer message for anyone who typed their code a minute
 * late.
 */

import type { Challenge } from "./verificationCode";

/** How long an expired challenge is kept so "expired" stays distinguishable. */
export const RETENTION_AFTER_EXPIRY_MS = 24 * 60 * 60 * 1000;

/** Challenges that expired before this instant may be deleted. */
export const cleanupCutoff = (now: number): number => now - RETENTION_AFTER_EXPIRY_MS;

/** Whether a challenge is past both its expiry and the grace period. */
export const isCleanable = (challenge: Pick<Challenge, "expiresAt">, now: number): boolean =>
  typeof challenge.expiresAt === "number" && challenge.expiresAt < cleanupCutoff(now);
