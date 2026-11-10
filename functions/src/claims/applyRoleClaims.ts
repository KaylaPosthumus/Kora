/**
 * The decision half of `syncRoleClaim`, with the Admin SDK held at arm's length.
 *
 * The trigger in `syncRoleClaim.ts` supplies a {@link ClaimsBackend} backed by
 * `firebase-admin`; a test supplies fakes. Everything that decides *whether* to
 * touch a token lives here, so none of it needs an emulator to exercise.
 */

import { claimsEqual, desiredClaims, nextClaims, type UserDoc } from "./roleClaims";

/** The three Admin SDK operations this needs, named for what they do here. */
export interface ClaimsBackend {
  /**
   * The user's current custom claims, or `undefined` when no auth account
   * exists for the uid.
   */
  readClaims(uid: string): Promise<Record<string, unknown> | undefined>;

  /** Replaces the user's entire custom-claims object. */
  writeClaims(uid: string, claims: Record<string, unknown>): Promise<void>;

  /**
   * Records that the uid's ID token is now stale. The client watches this to
   * know when to call `getIdToken(true)`.
   */
  recordRefresh(uid: string): Promise<void>;
}

export type SyncOutcome =
  /** Claims were rewritten; the token needs a refresh. */
  | { status: "updated"; claims: Record<string, unknown> }
  /** The write did not affect any managed claim. */
  | { status: "unchanged" }
  /** No auth account for this uid — nothing to put a claim on. */
  | { status: "no-auth-user" };

/**
 * Brings a uid's custom claims in line with their user document.
 *
 * Returns rather than throws for the two states that are not errors: a user
 * document with no auth account behind it (seed data, or a deletion that
 * removed the account first), and a write that changed nothing this function
 * manages. Both are common, and a thrown error would put the trigger into a
 * retry loop against input that will never improve.
 *
 * @param user the user document after the write, or `undefined` if deleted
 */
export const applyRoleClaims = async (
  uid: string,
  user: UserDoc | undefined,
  backend: ClaimsBackend
): Promise<SyncOutcome> => {
  const existing = await backend.readClaims(uid);
  if (existing === undefined) return { status: "no-auth-user" };

  const claims = nextClaims(existing, desiredClaims(user));

  // The trigger fires on every write to the document — a changed profile
  // picture included. Rewriting identical claims would cost an Admin SDK call
  // and churn the user's token for nothing.
  if (claimsEqual(existing, claims)) return { status: "unchanged" };

  await backend.writeClaims(uid, claims);

  // Ordered after the write: a client that refreshes on this signal must find
  // the new claims already in place.
  await backend.recordRefresh(uid);

  return { status: "updated", claims };
};
