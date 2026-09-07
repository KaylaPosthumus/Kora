/**
 * `cleanUpVerifications` — retires email verification challenges nothing can
 * use any more.
 *
 * Scheduled rather than triggered: there is no write to hang it off, because
 * the thing that makes a challenge stale is the passage of time. See
 * `challengeCleanup.ts` for why expired challenges are kept for a day first.
 *
 * Cloud Scheduler is a Blaze-plan service, like Cloud Functions itself.
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";

import { cleanupCutoff } from "./challengeCleanup";
import { VERIFICATIONS_COLLECTION } from "./verifyEmail";
import { chunk } from "../shared/chunk";
import { db } from "../shared/admin";

/** Kept well under the batch cap so one run cannot stall on a huge sweep. */
const MAX_PER_RUN = 2000;

export const cleanUpVerifications = onSchedule("every day 03:00", async () => {
  // A single inequality filter, so the automatic single-field index covers it.
  const snapshot = await db()
    .collection(VERIFICATIONS_COLLECTION)
    .where("expiresAt", "<", cleanupCutoff(Date.now()))
    .limit(MAX_PER_RUN)
    .select()
    .get();

  const ids = snapshot.docs.map((doc) => doc.id);
  if (ids.length === 0) {
    logger.debug("cleanUpVerifications: nothing to retire");
    return;
  }

  for (const batch of chunk(ids)) {
    const write = db().batch();
    batch.forEach((id) => write.delete(db().collection(VERIFICATIONS_COLLECTION).doc(id)));
    await write.commit();
  }

  // A run that hits the cap leaves the rest for tomorrow; saying so makes a
  // persistent backlog visible rather than silent.
  logger.info("cleanUpVerifications: challenges retired", {
    retired: ids.length,
    hitCap: ids.length === MAX_PER_RUN,
  });
});
