/**
 * `onEmployeeProfileWritten` — pushes a renamed employee out to the documents
 * that copied their name.
 *
 * `leaveRequests`, `meetings` and `performanceReviews` each carry
 * `employeeName`, copied at creation so admin lists render without a lookup per
 * row. Nothing refreshed them, so an employee who changed their name kept the
 * old one on every leave request an admin subsequently reviewed.
 */

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";

import { EMPLOYEE_MIRRORS, changedFields, pendingMirrors } from "../shared/denormalise";
import { applyMirrors } from "../shared/mirrorWriter";

/** The source fields any target copies. */
const WATCHED = ["fullName"] as const;

export const onEmployeeProfileWritten = onDocumentWritten(
  "employees/{employeeId}",
  async (event) => {
    const before = event.data?.before.exists ? event.data.before.data() : undefined;
    const after = event.data?.after.exists ? event.data.after.data() : undefined;

    // Nothing references a just-created employee, and onEmployeeDeleted owns
    // the delete path.
    if (before === undefined || after === undefined) return;

    const changed = changedFields(before, after, WATCHED);
    if (changed.length === 0) return;

    const pending = pendingMirrors(EMPLOYEE_MIRRORS, after, changed);
    const report = await applyMirrors(event.params.employeeId, pending);

    if (Object.keys(report).length > 0) {
      logger.info("onEmployeeProfileWritten: name propagated", {
        employeeId: event.params.employeeId,
        ...report,
      });
    }
  }
);
