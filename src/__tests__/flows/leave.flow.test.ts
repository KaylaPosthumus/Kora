import { describe, it, expect, beforeEach, vi } from "vitest";
import { firestoreMock } from "../../test/firestore";
import { LeaveStatus } from "../../types/common";
import type { LeaveBalance } from "../../interfaces/leave/leaveBalance";
import type { LeaveRequest } from "../../interfaces/leave/leaveRequest";

/**
 * Flow test — a leave request from submission to approval, seen from both sides.
 *
 * Three separate pieces have to agree for this to work, and each is easy to
 * change in isolation: the employee screen's live subscription, the admin
 * screen's one-shot query, and the transaction that flips the status and spends
 * the days. The unit tests pin each one; this pins the handover.
 *
 * The employee's leave screen is one of the few that subscribes rather than
 * reading once, so the assertions here are about what the *open page* sees after
 * the admin acts — not just about what ends up in the database.
 */

vi.mock("firebase/firestore", async () => (await import("../../test/firestore")).firestoreModule());
vi.mock("../../services/firebase", async () => (await import("../../test/firebaseApp")).firebaseAppModule());

interface LeaveSnapshot {
  leaveBalances: LeaveBalance[];
  leaveRequests: LeaveRequest[];
}

const EMPLOYEE_ID = "emp1";
const ANNUAL_BALANCE = `employees/${EMPLOYEE_ID}/leaveBalances/annual`;

const seedEmployee = (remainingDays = 15) => {
  firestoreMock.seed({
    [`employees/${EMPLOYEE_ID}`]: {
      userId: "uid1",
      fullName: "Eli Employee",
      email: "eli@kora.test",
      jobTitle: "Designer",
    },
    [ANNUAL_BALANCE]: {
      leaveTypeId: "annual",
      leaveTypeName: "Annual",
      description: "Annual leave",
      defaultDays: 15,
      remainingDays,
    },
    "leaveTypes/annual": {
      leaveTypeName: "Annual",
      description: "Annual leave",
      defaultDays: 15,
    },
  });
};

/** A three-day request: 2 Mar to 4 Mar inclusive. */
const threeDayRequest = {
  employeeId: EMPLOYEE_ID,
  leaveTypeId: "annual",
  startDate: "2026-03-02",
  endDate: "2026-03-04",
  comment: "Long weekend",
};

beforeEach(() => {
  firestoreMock.reset();
  vi.resetModules();
});

describe("submitting and approving leave", () => {
  it("shows the approval on the employee's open screen without a refresh", async () => {
    seedEmployee(15);
    const { empLeaveRequestsAPI, subscribeToEmployeeLeave } = await import(
      "../../services/api.service"
    );

    // The employee's leave page is mounted and subscribed.
    const emissions: LeaveSnapshot[] = [];
    const unsubscribe = subscribeToEmployeeLeave(EMPLOYEE_ID, (data) => emissions.push(data));

    expect(emissions).toHaveLength(1);
    expect(emissions[0].leaveRequests).toHaveLength(0);
    expect(emissions[0].leaveBalances[0].remainingDays).toBe(15);

    // They submit a request.
    const created = await empLeaveRequestsAPI.createLeaveRequest(threeDayRequest);
    const latest = () => emissions[emissions.length - 1];

    expect(latest().leaveRequests).toHaveLength(1);
    expect(latest().leaveRequests[0].status).toBe(LeaveStatus.Pending);
    // Nothing is spent until an admin approves.
    expect(latest().leaveBalances[0].remainingDays).toBe(15);

    // An admin approves it from their own screen.
    await empLeaveRequestsAPI.approveLeaveRequestById(created.data.id);

    expect(latest().leaveRequests[0].status).toBe(LeaveStatus.Approved);
    expect(latest().leaveBalances[0].remainingDays).toBe(12);

    unsubscribe();
    // Both listeners, or the page leaks one per navigation.
    expect(firestoreMock.listenerCount()).toBe(0);
  });

  it("puts the request in the admin's pending queue with the names already on it", async () => {
    seedEmployee();
    const { empLeaveRequestsAPI } = await import("../../services/api.service");

    await empLeaveRequestsAPI.createLeaveRequest(threeDayRequest);

    const pending = await empLeaveRequestsAPI.getPendingLeaveRequests();

    expect(pending.data).toHaveLength(1);
    // Denormalised at write time so the admin table renders in one query rather
    // than one query plus a lookup per row.
    expect(pending.data[0]).toMatchObject({
      employeeName: "Eli Employee",
      leaveTypeName: "Annual",
      status: LeaveStatus.Pending,
    });
  });

  it("moves the request between the admin's three queues as its status changes", async () => {
    seedEmployee();
    const { empLeaveRequestsAPI } = await import("../../services/api.service");
    const created = await empLeaveRequestsAPI.createLeaveRequest(threeDayRequest);

    const counts = async () => ({
      pending: (await empLeaveRequestsAPI.getPendingLeaveRequests()).data.length,
      approved: (await empLeaveRequestsAPI.getApprovedLeaveRequests()).data.length,
      rejected: (await empLeaveRequestsAPI.getRejectedLeaveRequests()).data.length,
    });

    expect(await counts()).toEqual({ pending: 1, approved: 0, rejected: 0 });

    await empLeaveRequestsAPI.approveLeaveRequestById(created.data.id);
    expect(await counts()).toEqual({ pending: 0, approved: 1, rejected: 0 });

    await empLeaveRequestsAPI.rejectLeaveRequestById(created.data.id);
    expect(await counts()).toEqual({ pending: 0, approved: 0, rejected: 1 });
  });

  it("gives the days back when an admin reverses an approval", async () => {
    seedEmployee(15);
    const { empLeaveRequestsAPI } = await import("../../services/api.service");
    const created = await empLeaveRequestsAPI.createLeaveRequest(threeDayRequest);

    await empLeaveRequestsAPI.approveLeaveRequestById(created.data.id);
    expect(firestoreMock.get(ANNUAL_BALANCE)?.remainingDays).toBe(12);

    await empLeaveRequestsAPI.rejectLeaveRequestById(created.data.id);

    // Back to where it started — the delta is computed from the transition, so
    // the refund is exactly what was spent.
    expect(firestoreMock.get(ANNUAL_BALANCE)?.remainingDays).toBe(15);
  });

  it("spends the days once when an impatient admin double-clicks approve", async () => {
    seedEmployee(15);
    const { empLeaveRequestsAPI } = await import("../../services/api.service");
    const created = await empLeaveRequestsAPI.createLeaveRequest(threeDayRequest);

    await empLeaveRequestsAPI.approveLeaveRequestById(created.data.id);
    await empLeaveRequestsAPI.approveLeaveRequestById(created.data.id);
    await empLeaveRequestsAPI.approveLeaveRequestById(created.data.id);

    expect(firestoreMock.get(ANNUAL_BALANCE)?.remainingDays).toBe(12);
  });

  it("lets an admin approve past the balance, going negative", async () => {
    seedEmployee(1);
    const { empLeaveRequestsAPI } = await import("../../services/api.service");
    const created = await empLeaveRequestsAPI.createLeaveRequest(threeDayRequest);

    await empLeaveRequestsAPI.approveLeaveRequestById(created.data.id);

    // Deliberate: OverBalanceConfirmModal warns the admin and they may proceed.
    // Clamping at zero here would silently grant free leave.
    expect(firestoreMock.get(ANNUAL_BALANCE)?.remainingDays).toBe(-2);
  });

  it("does not spend one employee's balance approving another's request", async () => {
    seedEmployee(15);
    firestoreMock.seed({
      "employees/emp2": { userId: "uid2", fullName: "Sam Second" },
      "employees/emp2/leaveBalances/annual": {
        leaveTypeId: "annual",
        leaveTypeName: "Annual",
        defaultDays: 15,
        remainingDays: 15,
      },
    });
    const { empLeaveRequestsAPI } = await import("../../services/api.service");

    const created = await empLeaveRequestsAPI.createLeaveRequest({
      ...threeDayRequest,
      employeeId: "emp2",
    });
    await empLeaveRequestsAPI.approveLeaveRequestById(created.data.id);

    expect(firestoreMock.get("employees/emp2/leaveBalances/annual")?.remainingDays).toBe(12);
    expect(firestoreMock.get(ANNUAL_BALANCE)?.remainingDays).toBe(15);
  });

  it("keeps one employee's requests off another's screen", async () => {
    seedEmployee();
    firestoreMock.seed({ "employees/emp2": { userId: "uid2", fullName: "Sam Second" } });
    const { empLeaveRequestsAPI, subscribeToEmployeeLeave } = await import(
      "../../services/api.service"
    );

    const emissions: LeaveSnapshot[] = [];
    const unsubscribe = subscribeToEmployeeLeave(EMPLOYEE_ID, (data) => emissions.push(data));

    await empLeaveRequestsAPI.createLeaveRequest({ ...threeDayRequest, employeeId: "emp2" });

    // Only one emission — the initial one. Sam's request does not match the
    // where clause, so Eli's page never sees it.
    expect(emissions).toHaveLength(1);
    unsubscribe();
  });

  it("still flips the status when the balance document is missing", async () => {
    seedEmployee();
    const { empLeaveRequestsAPI } = await import("../../services/api.service");
    const created = await empLeaveRequestsAPI.createLeaveRequest({
      ...threeDayRequest,
      leaveTypeId: "study",
    });

    // A leave type added after this employee was created has no balance doc.
    await empLeaveRequestsAPI.approveLeaveRequestById(created.data.id);

    expect(firestoreMock.get(`leaveRequests/${created.data.id}`)?.status).toBe(
      LeaveStatus.Approved
    );
  });

  it("writes nothing when the request has vanished", async () => {
    seedEmployee();
    const { empLeaveRequestsAPI } = await import("../../services/api.service");

    await expect(empLeaveRequestsAPI.approveLeaveRequestById("gone")).rejects.toThrow(
      /No leave request found/
    );
    expect(firestoreMock.get(ANNUAL_BALANCE)?.remainingDays).toBe(15);
  });
});

describe("the employee's leave screen", () => {
  it("waits for both the balances and the requests before it renders anything", async () => {
    seedEmployee();
    const { subscribeToEmployeeLeave } = await import("../../services/api.service");

    const onData = vi.fn();
    const unsubscribe = subscribeToEmployeeLeave(EMPLOYEE_ID, onData);

    // Emitting after the first listener answered would render an empty half —
    // a balance card with no requests under it, or the reverse.
    expect(onData).toHaveBeenCalledTimes(1);
    expect(onData.mock.calls[0][0]).toMatchObject({
      leaveBalances: expect.any(Array),
      leaveRequests: expect.any(Array),
    });

    unsubscribe();
  });

  it("survives the half-updated frame between the two writes of an approval", async () => {
    seedEmployee(15);
    const { empLeaveRequestsAPI, subscribeToEmployeeLeave } = await import(
      "../../services/api.service"
    );
    const created = await empLeaveRequestsAPI.createLeaveRequest(threeDayRequest);

    const emissions: LeaveSnapshot[] = [];
    const unsubscribe = subscribeToEmployeeLeave(EMPLOYEE_ID, (data) => emissions.push(data));

    await empLeaveRequestsAPI.approveLeaveRequestById(created.data.id);

    // The transaction writes two documents and the two listeners fire
    // separately, so a mid-flight emission is expected. What matters is that
    // every emission is internally coherent and the last one is correct.
    for (const emission of emissions) {
      expect(emission.leaveBalances).toHaveLength(1);
      expect(emission.leaveRequests).toHaveLength(1);
    }
    const final = emissions[emissions.length - 1];
    expect(final.leaveRequests[0].status).toBe(LeaveStatus.Approved);
    expect(final.leaveBalances[0].remainingDays).toBe(12);

    unsubscribe();
  });
});
