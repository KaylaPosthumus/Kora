/**
 * `syncRoleClaim` — mirrors `users/{uid}.role` into a custom claim.
 *
 * A Firestore trigger rather than a callable, deliberately. The user document
 * stays the single source of truth and the claim is derived from it, so every
 * path that sets a role is covered by one function: `setupUserAsEmployee`,
 * `linkUserAsAdmin`, `scripts/seed.mjs`, and a hand edit in the Firebase
 * console alike. A callable would only cover the callers that remembered to
 * call it.
 *
 * **The token-refresh gotcha.** A new claim does not reach the client until its
 * ID token refreshes, which can take up to an hour on its own. This writes
 * `userClaims/{uid}.refreshTime` after every change so the client can watch that
 * document and call `getIdToken(true)` promptly. Until it does, the `get()`
 * fallback in `firestore.rules` still authorises the user correctly — the claim
 * is the fast path, not the only one.
 */

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { FieldValue } from "firebase-admin/firestore";

import { applyRoleClaims, type ClaimsBackend } from "./applyRoleClaims";
import type { UserDoc } from "./roleClaims";
import { auth, db } from "../shared/admin";

/** Where the client watches for "your token is stale". */
export const CLAIMS_METADATA_COLLECTION = "userClaims";

/** {@link ClaimsBackend} backed by the Admin SDK. */
export const adminClaimsBackend = (): ClaimsBackend => ({
  readClaims: async (uid) => {
    try {
      const user = await auth().getUser(uid);
      return user.customClaims ?? {};
    } catch (error) {
      // A user document can outlive its auth account. That is not an error
      // worth retrying — there is simply no token to put a claim on.
      if ((error as { code?: string })?.code === "auth/user-not-found") return undefined;
      throw error;
    }
  },

  writeClaims: async (uid, claims) => {
    await auth().setCustomUserClaims(uid, claims);
  },

  recordRefresh: async (uid) => {
    // A separate collection on purpose: writing this back onto users/{uid}
    // would re-fire this very trigger.
    await db()
      .collection(CLAIMS_METADATA_COLLECTION)
      .doc(uid)
      .set({ refreshTime: FieldValue.serverTimestamp() }, { merge: true });
  },
});

export const syncRoleClaim = onDocumentWritten("users/{uid}", async (event) => {
  const uid = event.params.uid;
  const user = event.data?.after.exists
    ? (event.data.after.data() as UserDoc)
    : undefined;

  const outcome = await applyRoleClaims(uid, user, adminClaimsBackend());

  switch (outcome.status) {
    case "updated":
      logger.info("syncRoleClaim: claims updated", { uid, claims: outcome.claims });
      break;
    case "unchanged":
      logger.debug("syncRoleClaim: no managed claim changed", { uid });
      break;
    case "no-auth-user":
      logger.warn("syncRoleClaim: no auth account for uid", { uid });
      break;
  }
});
