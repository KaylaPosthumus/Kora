import { describe, it, expect, vi, beforeEach } from "vitest";
import { LeaveStatus } from "@/shared/types/common";

/**
 * Smoke tests for approve-and-decrement (phase 2 of NEXT_MIGRATION_PLAN).
 *
 * This is the one write in the app that has to be atomic: approving a leave
 * request flips its status AND spends days off the matching balance. It runs
 * inside `runTransaction`, so what is worth pinning down is the delta logic —
 * that the balance moves exactly once, in the right direction, and only when
 * the status actually crosses the approved boundary.
 *
 * Firestore is mocked: `runTransaction` invokes the callback with a fake
 * transaction that records reads and writes, so the assertions are about what
 * the callback *would* write rather than about the SDK.
 */

/** Refs are opaque to the code under test — a tagged object is enough to match on. */
const makeRef = (path: string) => ({ path });

const snap = (data: unknown | null) => ({
  exists: () => data !== null,
  data: () => data,
});

/** Docs the fake transaction will read, keyed by ref path. */
let store: Record<string, unknown | null>;
/** Every `transaction.update` call, in order. */
let updates: Array<{ path: string; data: Record<string, unknown> }>;

vi.mock("../firebase", () => ({
  db: { __fake: "db" },
  auth: {},
  storage: {},
  googleProvider: {},
}));

vi.mock("firebase/firestore", () => {
  const doc = (...args: unknown[]) => {
    // doc(col, id) from a collection ref, or doc(db, "employees", id, "leaveBalances", typeId)
    const [first, ...rest] = args;
    const base = (first as { __path?: string })?.__path ?? "";
    return makeRef([base, ...rest].filter(Boolean).join("/"));
  };

  return {
    collection: (_db: unknown, path: string) => ({ __path: path }),
    doc,
    getDoc: vi.fn(async () => snap(null)),
    getDocs: vi.fn(async () => ({ docs: [] })),
    addDoc: vi.fn(async () => makeRef("new")),
    setDoc: vi.fn(async () => undefined),
    updateDoc: vi.fn(async () => undefined),
    deleteDoc: vi.fn(async () => undefined),
    query: (...args: unknown[]) => args,
    where: (...args: unknown[]) => ({ type: "where", args }),
    orderBy: (...args: unknown[]) => ({ type: "orderBy", args }),
    limit: (n: number) => ({ type: "limit", n }),
    documentId: () => "__name__",
    // Unused here, but api.service imports it — keep the mock a faithful stand-in.
    onSnapshot: vi.fn(() => () => undefined),
    serverTimestamp: () => "SERVER_TS",
    writeBatch: () => ({ set: vi.fn(), update: vi.fn(), delete: vi.fn(), commit: vi.fn() }),
    runTransaction: async (_db: unknown, cb: (t: unknown) => Promise<void>) =>
      cb({
        get: async (ref: { path: string }) => snap(store[ref.path] ?? null),
        update: (ref: { path: string }, data: Record<string, unknown>) =>
          updates.push({ path: ref.path, data }),
        set: (ref: { path: string }, data: Record<string, unknown>) =>
          updates.push({ path: ref.path, data }),
      }),
  };
});

const REQUEST_ID = "req1";
const REQUEST_PATH = `leaveRequests/${REQUEST_ID}`;
const BALANCE_PATH = "employees/emp1/leaveBalances/annual";

/** A 3-day request (inclusive of both ends) sitting in `status`. */
const seedRequest = (status: LeaveStatus, remainingDays = 10) => {
  store = {
    [REQUEST_PATH]: {
      employeeId: "emp1",
      leaveTypeId: "annual",
      startDate: "2026-03-02",
      endDate: "2026-03-04",
      status,
    },
    [BALANCE_PATH]: { remainingDays },
  };
};

const balanceWrites = () => updates.filter((u) => u.path === BALANCE_PATH);
const statusWrites = () => updates.filter((u) => u.path === REQUEST_PATH);

describe("approve-and-decrement leave transaction", () => {
  beforeEach(() => {
    updates = [];
    store = {};
  });

  it("decrements the balance exactly once when approving", async () => {
    seedRequest(LeaveStatus.Pending, 10);
    const { empLeaveRequestsAPI } = await import("../api.service");

    await empLeaveRequestsAPI.approveLeaveRequestById(REQUEST_ID);

    expect(balanceWrites()).toHaveLength(1);
    // 2 Mar → 4 Mar inclusive is 3 days.
    expect(balanceWrites()[0].data).toEqual({ remainingDays: 7 });
    expect(statusWrites()[0].data).toEqual({ status: LeaveStatus.Approved });
  });

  it("gives the days back when an approved request is rejected", async () => {
    seedRequest(LeaveStatus.Approved, 7);
    const { empLeaveRequestsAPI } = await import("../api.service");

    await empLeaveRequestsAPI.rejectLeaveRequestById(REQUEST_ID);

    expect(balanceWrites()).toHaveLength(1);
    expect(balanceWrites()[0].data).toEqual({ remainingDays: 10 });
    expect(statusWrites()[0].data).toEqual({ status: LeaveStatus.Rejected });
  });

  it("gives the days back when an approved request goes back to pending", async () => {
    seedRequest(LeaveStatus.Approved, 7);
    const { empLeaveRequestsAPI } = await import("../api.service");

    await empLeaveRequestsAPI.setLeaveRequestToPendingById(REQUEST_ID);

    expect(balanceWrites()[0].data).toEqual({ remainingDays: 10 });
  });

  it("does not touch the balance when re-approving an already-approved request", async () => {
    seedRequest(LeaveStatus.Approved, 7);
    const { empLeaveRequestsAPI } = await import("../api.service");

    await empLeaveRequestsAPI.approveLeaveRequestById(REQUEST_ID);

    // Same status in and out — the whole transaction is a no-op, which is what
    // stops a double-click from spending the days twice.
    expect(updates).toHaveLength(0);
  });

  it("does not touch the balance moving between two non-approved statuses", async () => {
    seedRequest(LeaveStatus.Pending, 10);
    const { empLeaveRequestsAPI } = await import("../api.service");

    await empLeaveRequestsAPI.rejectLeaveRequestById(REQUEST_ID);

    expect(balanceWrites()).toHaveLength(0);
    expect(statusWrites()[0].data).toEqual({ status: LeaveStatus.Rejected });
  });

  it("still flips the status when the balance document is missing", async () => {
    seedRequest(LeaveStatus.Pending, 10);
    delete store[BALANCE_PATH];
    const { empLeaveRequestsAPI } = await import("../api.service");

    await empLeaveRequestsAPI.approveLeaveRequestById(REQUEST_ID);

    expect(balanceWrites()).toHaveLength(0);
    expect(statusWrites()[0].data).toEqual({ status: LeaveStatus.Approved });
  });

  it("lets an over-balance approval go negative", async () => {
    // Deliberate: AdminLeaveRequests warns via OverBalanceConfirmModal and the
    // admin may still approve. The transaction must not silently clamp.
    seedRequest(LeaveStatus.Pending, 1);
    const { empLeaveRequestsAPI } = await import("../api.service");

    await empLeaveRequestsAPI.approveLeaveRequestById(REQUEST_ID);

    expect(balanceWrites()[0].data).toEqual({ remainingDays: -2 });
  });

  it("throws rather than writing when the request does not exist", async () => {
    store = {};
    const { empLeaveRequestsAPI } = await import("../api.service");

    await expect(empLeaveRequestsAPI.approveLeaveRequestById(REQUEST_ID)).rejects.toThrow(
      /No leave request found/
    );
    expect(updates).toHaveLength(0);
  });
});
