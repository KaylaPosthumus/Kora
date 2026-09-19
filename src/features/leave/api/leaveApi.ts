/**
 * Leave types, leave requests and the balances they draw down.
 *
 * `setLeaveRequestStatus` is the only place a balance moves, and it is the one
 * piece of genuine integrity logic in the client. It computes a delta from the
 * status *transition*, so re-approving an approved request is a no-op and moving
 * off approved refunds the days. It deliberately does not clamp at zero —
 * `OverBalanceConfirmModal` warns the admin, who may proceed.
 */

import {
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  runTransaction,
  type FirestoreError,
} from "firebase/firestore";
import {
  LeaveStatus,
} from "@/shared/types/common";
import type { LeaveBalance } from "@/shared/types/leaveBalance";
import type { LeaveRequest } from "@/shared/types/leaveRequest";
import {
  ok,
  employeesCol,
  leaveTypesCol,
  leaveRequestsCol,
  leaveBalancesCol,
  toLeaveBalance,
  toLeaveRequest,
  subscribePair,
} from "@/shared/lib/firestore";
import type {
  ApiResponse,
  Unsubscribe,
} from "@/shared/lib/firestore";
import { db } from "@/services/firebase";
import { calculateDurationInDays } from "@/utils/dateUtils";

export const leaveTypesAPI = {
  getAllLeaveTypes: async (): Promise<ApiResponse<any[]>> => {
    const snapshot = await getDocs(query(leaveTypesCol, orderBy("leaveTypeName")));
    return ok(snapshot.docs.map((d) => ({ leaveTypeId: d.id, ...d.data() })));
  },
};

/** Reads leave requests with a given status, newest first. */
const getLeaveRequestsByStatus = async (
  status: LeaveStatus
): Promise<ApiResponse<LeaveRequest[]>> => {
  const snapshot = await getDocs(
    query(leaveRequestsCol, where("status", "==", status), orderBy("createdAt", "desc"))
  );
  return ok(snapshot.docs.map((d) => toLeaveRequest(d.id, d.data())));
};

/**
 * Moves a leave request between statuses, keeping the employee's balance correct.
 *
 * On the old backend approve-and-decrement was one server-side endpoint and so was
 * atomic for free. Here it is two writes, which is exactly why this runs inside a
 * `runTransaction` — shipping it as two `updateDoc` calls would let a failure
 * between them leave a request approved with the days never deducted.
 *
 * This works because a balance document is keyed by its leave type id: the client
 * SDK can't run queries inside a transaction, only direct document reads.
 */
const setLeaveRequestStatus = async (
  id: string,
  nextStatus: LeaveStatus
): Promise<ApiResponse<null>> => {
  await runTransaction(db, async (transaction) => {
    const requestRef = doc(leaveRequestsCol, id);
    const requestSnapshot = await transaction.get(requestRef);

    if (!requestSnapshot.exists()) {
      throw new Error(`No leave request found with id ${id}`);
    }

    const request = requestSnapshot.data();
    const previousStatus: LeaveStatus = request.status;

    if (previousStatus === nextStatus) return;

    const days = calculateDurationInDays(request.startDate, request.endDate);
    const balanceRef = doc(
      db,
      "employees",
      request.employeeId,
      "leaveBalances",
      request.leaveTypeId
    );
    const balanceSnapshot = await transaction.get(balanceRef);

    // Approving spends the days; moving *off* approved (rejected, or back to
    // pending) gives them back.
    let delta = 0;
    if (nextStatus === LeaveStatus.Approved) delta = -days;
    else if (previousStatus === LeaveStatus.Approved) delta = days;

    if (delta !== 0 && balanceSnapshot.exists()) {
      transaction.update(balanceRef, {
        remainingDays: balanceSnapshot.data().remainingDays + delta,
      });
    }

    transaction.update(requestRef, { status: nextStatus });
  });

  return ok(null);
};

export const empLeaveRequestsAPI = {
  getPendingLeaveRequests: () => getLeaveRequestsByStatus(LeaveStatus.Pending),
  getApprovedLeaveRequests: () => getLeaveRequestsByStatus(LeaveStatus.Approved),
  getRejectedLeaveRequests: () => getLeaveRequestsByStatus(LeaveStatus.Rejected),

  approveLeaveRequestById: (id: string) => setLeaveRequestStatus(id, LeaveStatus.Approved),
  rejectLeaveRequestById: (id: string) => setLeaveRequestStatus(id, LeaveStatus.Rejected),
  setLeaveRequestToPendingById: (id: string) => setLeaveRequestStatus(id, LeaveStatus.Pending),

  /**
   * Submits a leave request. The employee and leave type names are copied onto the
   * request so the admin list renders without a lookup per row.
   */
  createLeaveRequest: async (data: {
    employeeId: string;
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    comment: string;
  }): Promise<ApiResponse<{ id: string }>> => {
    const [employeeSnapshot, leaveTypeSnapshot] = await Promise.all([
      getDoc(doc(employeesCol, data.employeeId)),
      getDoc(doc(leaveTypesCol, data.leaveTypeId)),
    ]);

    const created = await addDoc(leaveRequestsCol, {
      employeeId: data.employeeId,
      employeeName: employeeSnapshot.data()?.fullName ?? "",
      leaveTypeId: data.leaveTypeId,
      leaveTypeName: leaveTypeSnapshot.data()?.leaveTypeName ?? "",
      description: leaveTypeSnapshot.data()?.description ?? "",
      defaultDays: leaveTypeSnapshot.data()?.defaultDays ?? 0,
      startDate: data.startDate,
      endDate: data.endDate,
      comment: data.comment,
      status: LeaveStatus.Pending,
      createdAt: new Date().toISOString(),
    });

    return ok({ id: created.id }, 201);
  },
};

/** Live version of `pageAPI.getEmployeeLeaveData`. */
export const subscribeToEmployeeLeave = (
  employeeId: string,
  onData: (data: { leaveBalances: LeaveBalance[]; leaveRequests: LeaveRequest[] }) => void,
  onError?: (error: FirestoreError) => void
): Unsubscribe =>
  subscribePair(
    leaveBalancesCol(employeeId),
    query(leaveRequestsCol, where("employeeId", "==", employeeId), orderBy("createdAt", "desc")),
    (balances, requests) => ({
      leaveBalances: balances.docs.map((d) => toLeaveBalance(d.id, d.data())),
      leaveRequests: requests.docs.map((d) => toLeaveRequest(d.id, d.data())),
    }),
    onData,
    onError
  );

// Page-shaped reads ------------------------------------------------------------------------------

/** The employee's leave screen: their balances plus their own requests. */
export const getEmployeeLeaveData = async (id: string): Promise<ApiResponse<any>> => {
  const [balancesSnapshot, requestsSnapshot] = await Promise.all([
    getDocs(leaveBalancesCol(id)),
    getDocs(
      query(
        leaveRequestsCol,
        where("employeeId", "==", id),
        orderBy("createdAt", "desc")
      )
    ),
  ]);

  return ok({
    leaveBalances: balancesSnapshot.docs.map((d) => toLeaveBalance(d.id, d.data())),
    leaveRequests: requestsSnapshot.docs.map((d) => toLeaveRequest(d.id, d.data())),
  });
};
