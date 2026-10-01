/**
 * `leaveRequests/{requestId}` — self-approval, and the inverted-date hole.
 *
 * Two things the rules are load-bearing for here:
 *
 * - **Status.** An employee files a request as `pending` and only an admin
 *   moves it. Otherwise the approval step is self-service.
 * - **Date ordering.** `calculateDurationInDays` is `end.diff(start) + 1`, so
 *   an inverted range yields a *negative* duration, and `setLeaveRequestStatus`
 *   computes `delta = -days` — which for a negative duration *adds* days to the
 *   balance on approval. Since an employee may amend the dates of a pending
 *   request, leaving this unchecked is a self-service way to grant yourself
 *   leave. It has to hold on update as well as create.
 */

import { describe, it, expect, beforeEach } from "vitest";

import { ALLOW, DENY, as, seed, useEmulator } from "../harness";
import { admin, jo, leaveRequest, sam, sam_suspended, seedWorld } from "../fixtures";

useEmulator();
beforeEach(async () => {
  await seedWorld();
  await seed("leaveRequests/req-pending", leaveRequest());
  await seed("leaveRequests/req-approved", leaveRequest({ status: "approved" }));
  await seed("leaveRequests/req-jo", leaveRequest({ employeeId: "emp-jo" }));
});

describe("filing a request", () => {
  it("lets an employee file their own as pending", async () => {
    expect(await as(sam).set("leaveRequests/new", leaveRequest())).toBe(ALLOW);
  });

  it("refuses a request filed as already approved", async () => {
    expect(
      await as(sam).set("leaveRequests/new", leaveRequest({ status: "approved" }))
    ).toBe(DENY);
  });

  it("refuses filing on behalf of another employee", async () => {
    expect(
      await as(sam).set("leaveRequests/new", leaveRequest({ employeeId: "emp-jo" }))
    ).toBe(DENY);
  });

  it("refuses a status outside the enum", async () => {
    expect(
      await as(sam).set("leaveRequests/new", leaveRequest({ status: "Pending" }))
    ).toBe(DENY);
    expect(
      await as(admin).set("leaveRequests/new", leaveRequest({ status: "cancelled" }))
    ).toBe(DENY);
  });

  it("refuses a suspended employee", async () => {
    expect(await as(sam_suspended).set("leaveRequests/new", leaveRequest())).toBe(DENY);
  });

  it("lets an admin file one in any state", async () => {
    expect(
      await as(admin).set("leaveRequests/new", leaveRequest({ status: "approved" }))
    ).toBe(ALLOW);
  });
});

describe("date ordering", () => {
  it("accepts a single-day request", async () => {
    expect(
      await as(sam).set(
        "leaveRequests/new",
        leaveRequest({ startDate: "2026-03-02", endDate: "2026-03-02" })
      )
    ).toBe(ALLOW);
  });

  it("refuses an inverted range on create", async () => {
    expect(
      await as(sam).set(
        "leaveRequests/new",
        leaveRequest({ startDate: "2026-03-06", endDate: "2026-03-02" })
      )
    ).toBe(DENY);
  });

  // The amendment path is the one that actually mattered: a pending request
  // can be re-dated by its owner.
  it("refuses an employee inverting the dates by amendment", async () => {
    expect(
      await as(sam).update("leaveRequests/req-pending", {
        startDate: "2026-03-06",
        endDate: "2026-03-02",
      })
    ).toBe(DENY);
  });

  it("refuses an admin inverting them too", async () => {
    expect(
      await as(admin).update("leaveRequests/req-pending", {
        startDate: "2026-12-31",
        endDate: "2026-01-01",
      })
    ).toBe(DENY);
  });

  it("refuses non-string dates", async () => {
    expect(
      await as(sam).set("leaveRequests/new", leaveRequest({ startDate: null }))
    ).toBe(DENY);
  });
});

describe("amending a request", () => {
  it("lets an employee revise their own pending request", async () => {
    expect(
      await as(sam).update("leaveRequests/req-pending", {
        startDate: "2026-04-01",
        endDate: "2026-04-03",
        comment: "Moved",
      })
    ).toBe(ALLOW);
  });

  it("refuses an employee approving their own request", async () => {
    expect(
      await as(sam).update("leaveRequests/req-pending", { status: "approved" })
    ).toBe(DENY);
  });

  it("refuses amending a request that has already been approved", async () => {
    expect(
      await as(sam).update("leaveRequests/req-approved", { comment: "Sneaky" })
    ).toBe(DENY);
  });

  // Re-pointing at a different leave type would debit a balance that was never
  // the one requested against.
  it("refuses moving a request to another leave type", async () => {
    expect(
      await as(sam).update("leaveRequests/req-pending", { leaveTypeId: "sick" })
    ).toBe(DENY);
    expect(
      await as(admin).update("leaveRequests/req-pending", { leaveTypeId: "sick" })
    ).toBe(DENY);
  });

  it("refuses reassigning a request to another employee", async () => {
    expect(
      await as(admin).update("leaveRequests/req-pending", { employeeId: "emp-jo" })
    ).toBe(DENY);
  });

  it("refuses amending another employee's request", async () => {
    expect(await as(jo).update("leaveRequests/req-pending", { comment: "No" })).toBe(
      DENY
    );
  });

  it("refuses a suspended employee amending theirs", async () => {
    expect(
      await as(sam_suspended).update("leaveRequests/req-pending", { comment: "No" })
    ).toBe(DENY);
  });

  it("lets an admin approve", async () => {
    expect(
      await as(admin).update("leaveRequests/req-pending", { status: "approved" })
    ).toBe(ALLOW);
  });
});

describe("reading and deleting", () => {
  it("lets an employee read their own", async () => {
    expect(await as(sam).get("leaveRequests/req-pending")).toBe(ALLOW);
  });

  it("refuses reading another employee's", async () => {
    expect(await as(sam).get("leaveRequests/req-jo")).toBe(DENY);
  });

  it("lets an employee query their own by employeeId", async () => {
    expect(await as(sam).query("leaveRequests", "employeeId", "emp-sam")).toBe(ALLOW);
  });

  it("refuses querying another employee's", async () => {
    expect(await as(sam).query("leaveRequests", "employeeId", "emp-jo")).toBe(DENY);
  });

  it("refuses an employee deleting a request", async () => {
    expect(await as(sam).remove("leaveRequests/req-pending")).toBe(DENY);
  });

  it("lets an admin delete one", async () => {
    expect(await as(admin).remove("leaveRequests/req-pending")).toBe(ALLOW);
  });
});
