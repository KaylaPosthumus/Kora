/**
 * The two callables behind email verification, replacing CoriCore's
 * `/Auth/request-verification` and the code check inside
 * `/Auth/register-verified`.
 *
 * Both are callables rather than triggers: each one answers a user action and
 * has to report a result the UI branches on. They take the uid from the verified
 * ID token rather than from the payload — a uid supplied by the caller would let
 * anyone verify anyone's address.
 */

import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";

import {
  confirmVerification,
  requestVerification,
  type VerificationBackend,
} from "./verificationService";
import { MAIL_COLLECTION } from "./mail";
import type { Challenge } from "./verificationCode";
import { auth, db } from "../shared/admin";

/**
 * Where challenges live. No client rule grants access to this collection, so it
 * is reachable only through the Admin SDK — see `firestore.rules`.
 */
export const VERIFICATIONS_COLLECTION = "emailVerifications";

/** {@link VerificationBackend} backed by the Admin SDK. */
export const adminVerificationBackend = (): VerificationBackend => {
  const challengeRef = (uid: string) => db().collection(VERIFICATIONS_COLLECTION).doc(uid);

  return {
    readAccount: async (uid) => {
      try {
        const user = await auth().getUser(uid);
        return {
          email: user.email,
          displayName: user.displayName,
          emailVerified: user.emailVerified,
        };
      } catch (error) {
        if ((error as { code?: string })?.code === "auth/user-not-found") return undefined;
        throw error;
      }
    },

    readChallenge: async (uid) => {
      const snapshot = await challengeRef(uid).get();
      return snapshot.exists ? (snapshot.data() as Challenge) : undefined;
    },

    writeChallenge: async (uid, challenge) => {
      await challengeRef(uid).set(challenge);
    },

    deleteChallenge: async (uid) => {
      await challengeRef(uid).delete();
    },

    recordAttempts: async (uid, attempts) => {
      await challengeRef(uid).update({ attempts });
    },

    markVerified: async (uid) => {
      await auth().updateUser(uid, { emailVerified: true });
    },

    enqueueMail: async (mail) => {
      await db().collection(MAIL_COLLECTION).add(mail);
    },
  };
};

/** The uid from the verified ID token, or a rejection. */
const requireUid = (request: CallableRequest): string => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in before verifying an email address.");
  }
  return uid;
};

/** Issues a 6-digit code and queues the email carrying it. */
export const requestEmailVerification = onCall(async (request) => {
  const uid = requireUid(request);

  const outcome = await requestVerification(uid, adminVerificationBackend(), Date.now());

  // Logged without the code: it is a live credential for the next ten minutes,
  // and Cloud Logging is readable by anyone with project access.
  logger.info("requestEmailVerification", { uid, status: outcome.status });

  return outcome;
});

/** Checks a submitted code and, on a match, marks the address verified. */
export const confirmEmailVerification = onCall(async (request) => {
  const uid = requireUid(request);
  const submitted = (request.data as { code?: unknown } | undefined)?.code;

  const outcome = await confirmVerification(
    uid,
    submitted,
    adminVerificationBackend(),
    Date.now()
  );

  logger.info("confirmEmailVerification", { uid, status: outcome.status });

  return outcome;
});
