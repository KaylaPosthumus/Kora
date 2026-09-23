/**
 * `onAdminProfileWritten` — pushes a renamed admin out to the gatherings that
 * copied their name.
 *
 * `meetings` and `performanceReviews` carry `adminName`. Leave requests do not,
 * which is why the admin fan-out is narrower than the employee one.
 */

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";

import { ADMIN_MIRRORS, changedFields, pendingMirrors } from "../shared/denormalise";
import { applyMirrors } from "../shared/mirrorWriter";

const WATCHED = ["fullName"] as const;

export const onAdminProfileWritten = onDocumentWritten(
  "admins/{adminId}",
  async (event) => {
    const before = event.data?.before.exists ? event.data.before.data() : undefined;
    const after = event.data?.after.exists ? event.data.after.data() : undefined;

    // onAdminDeleted owns the delete path, and nothing references a new admin.
    if (before === undefined || after === undefined) return;

    const changed = changedFields(before, after, WATCHED);
    if (changed.length === 0) return;

    const pending = pendingMirrors(ADMIN_MIRRORS, after, changed);
    const report = await applyMirrors(event.params.adminId, pending);

    if (Object.keys(report).length > 0) {
      logger.info("onAdminProfileWritten: name propagated", {
        adminId: event.params.adminId,
        ...report,
      });
    }
  }
);
