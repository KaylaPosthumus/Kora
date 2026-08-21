import { describe, it, expect, vi, beforeEach } from "vitest";
import { GatheringType, MeetStatus } from "../../types/common";

/**
 * Smoke tests for the live-read layer (the onSnapshot subscriptions behind the
 * employee screens).
 *
 * Each subscription spans two collections, which is where the behaviour that is
 * easy to get wrong lives: emitting before both listeners have delivered would
 * render an empty half for a frame, and failing to tear both down on unmount
 * leaks a listener per navigation. Firestore is mocked, so `onSnapshot` here is
 * a hand-driven pair of callbacks rather than a live connection.
 */

type SnapshotHandler = (snapshot: { docs: Array<{ id: string; data: () => unknown }> }) => void;
type ErrorHandler = (error: unknown) => void;

/** Every onSnapshot registration, in call order. */
let listeners: Array<{
  tag: string;
  emit: SnapshotHandler;
  fail: ErrorHandler;
  unsubscribe: ReturnType<typeof vi.fn>;
}>;

const docsOf = (records: Array<{ id: string } & Record<string, unknown>>) => ({
  docs: records.map(({ id, ...rest }) => ({ id, data: () => rest })),
});

vi.mock("../firebase", () => ({
  db: { __fake: "db" },
  auth: {},
  storage: {},
  googleProvider: {},
}));

vi.mock("firebase/firestore", () => ({
  // `query(collection, ...constraints)` — keep the collection tag so a listener
  // can be told apart from its sibling.
  collection: (_db: unknown, ...segments: string[]) => ({ __tag: segments.join("/") }),
  query: (source: { __tag?: string }, ...constraints: unknown[]) => ({
    __tag: source?.__tag ?? "unknown",
    constraints,
  }),
  doc: (...args: unknown[]) => ({ __path: args.join("/") }),
  where: (...args: unknown[]) => ({ type: "where", args }),
  orderBy: (...args: unknown[]) => ({ type: "orderBy", args }),
  limit: (n: number) => ({ type: "limit", n }),
  documentId: () => "__name__",
  serverTimestamp: () => "SERVER_TS",
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  writeBatch: vi.fn(),
  runTransaction: vi.fn(),
  onSnapshot: (
    source: { __tag?: string },
    onNext: SnapshotHandler,
    onError: ErrorHandler
  ) => {
    const unsubscribe = vi.fn();
    listeners.push({ tag: source?.__tag ?? "unknown", emit: onNext, fail: onError, unsubscribe });
    return unsubscribe;
  },
}));

const listenerFor = (tag: string) => {
  const found = listeners.find((listener) => listener.tag === tag);
  if (!found) throw new Error(`no listener registered for ${tag}, got: ${listeners.map((l) => l.tag).join(", ")}`);
  return found;
};

beforeEach(() => {
  listeners = [];
});

describe("subscribeToGatherings", () => {
  it("waits for both collections before emitting", async () => {
    const { subscribeToGatherings } = await import("../api.service");
    const onData = vi.fn();

    subscribeToGatherings({ field: "employeeId", id: "emp1" }, onData);

    expect(listeners).toHaveLength(2);

    // Only the meetings side has answered — emitting now would show an empty
    // performance-review half.
    listenerFor("meetings").emit(docsOf([{ id: "m1", startDate: "2026-03-02" }]));
    expect(onData).not.toHaveBeenCalled();

    listenerFor("performanceReviews").emit(docsOf([]));
    expect(onData).toHaveBeenCalledTimes(1);
  });

  it("merges both collections and sorts by start date", async () => {
    const { subscribeToGatherings } = await import("../api.service");
    const onData = vi.fn();

    subscribeToGatherings({ field: "employeeId", id: "emp1" }, onData);

    listenerFor("meetings").emit(
      docsOf([
        { id: "m-late", startDate: "2026-05-01", status: MeetStatus.Upcoming },
        { id: "m-early", startDate: "2026-01-01", status: MeetStatus.Upcoming },
      ])
    );
    listenerFor("performanceReviews").emit(docsOf([{ id: "r-mid", startDate: "2026-03-01" }]));

    const merged = onData.mock.calls[0][0];
    expect(merged.map((g: { id: string }) => g.id)).toEqual(["m-early", "r-mid", "m-late"]);
    expect(merged.map((g: { type: string }) => g.type)).toEqual([
      GatheringType.Meeting,
      GatheringType.PerformanceReview,
      GatheringType.Meeting,
    ]);
  });

  it("re-emits when either side changes afterwards", async () => {
    const { subscribeToGatherings } = await import("../api.service");
    const onData = vi.fn();

    subscribeToGatherings({ field: "employeeId", id: "emp1" }, onData);
    listenerFor("meetings").emit(docsOf([{ id: "m1", startDate: "2026-03-02" }]));
    listenerFor("performanceReviews").emit(docsOf([]));
    expect(onData).toHaveBeenCalledTimes(1);

    // An admin schedules a second meeting while the page is open.
    listenerFor("meetings").emit(
      docsOf([
        { id: "m1", startDate: "2026-03-02" },
        { id: "m2", startDate: "2026-03-05" },
      ])
    );

    expect(onData).toHaveBeenCalledTimes(2);
    expect(onData.mock.calls[1][0]).toHaveLength(2);
  });

  it("tears down both listeners on unsubscribe", async () => {
    const { subscribeToGatherings } = await import("../api.service");

    const unsubscribe = subscribeToGatherings({ field: "employeeId", id: "emp1" }, vi.fn());
    unsubscribe();

    // Both, or the survivor leaks a listener on every navigation.
    expect(listeners.every((listener) => listener.unsubscribe.mock.calls.length === 1)).toBe(true);
  });

  it("reports errors instead of emitting", async () => {
    const { subscribeToGatherings } = await import("../api.service");
    const onData = vi.fn();
    const onError = vi.fn();

    subscribeToGatherings({ field: "employeeId", id: "emp1" }, onData, onError);
    // A denied read or a missing index arrives here, not as a rejected promise.
    listenerFor("meetings").fail({ code: "permission-denied" });

    expect(onError).toHaveBeenCalledWith({ code: "permission-denied" });
    expect(onData).not.toHaveBeenCalled();
  });
});

describe("subscribeToEmployeeLeave", () => {
  it("emits balances and requests together once both arrive", async () => {
    const { subscribeToEmployeeLeave } = await import("../api.service");
    const onData = vi.fn();

    subscribeToEmployeeLeave("emp1", onData);
    expect(listeners).toHaveLength(2);

    listenerFor("employees/emp1/leaveBalances").emit(
      docsOf([{ id: "annual", leaveTypeName: "Annual", remainingDays: 7, defaultDays: 10 }])
    );
    expect(onData).not.toHaveBeenCalled();

    listenerFor("leaveRequests").emit(
      docsOf([{ id: "req1", employeeId: "emp1", status: "pending" }])
    );

    expect(onData).toHaveBeenCalledTimes(1);
    const payload = onData.mock.calls[0][0];
    expect(payload.leaveBalances).toHaveLength(1);
    expect(payload.leaveRequests).toHaveLength(1);
  });

  it("re-emits when an approval moves the balance", async () => {
    const { subscribeToEmployeeLeave } = await import("../api.service");
    const onData = vi.fn();

    subscribeToEmployeeLeave("emp1", onData);
    listenerFor("employees/emp1/leaveBalances").emit(
      docsOf([{ id: "annual", leaveTypeName: "Annual", remainingDays: 10, defaultDays: 10 }])
    );
    listenerFor("leaveRequests").emit(docsOf([{ id: "req1", status: "pending" }]));

    // The approve-and-decrement transaction writes both documents; the two
    // listeners fire separately, so the page must survive a half-updated frame.
    listenerFor("leaveRequests").emit(docsOf([{ id: "req1", status: "approved" }]));
    listenerFor("employees/emp1/leaveBalances").emit(
      docsOf([{ id: "annual", leaveTypeName: "Annual", remainingDays: 7, defaultDays: 10 }])
    );

    expect(onData).toHaveBeenCalledTimes(3);
    const final = onData.mock.calls[2][0];
    expect(final.leaveRequests[0].status).toBe("approved");
    expect(final.leaveBalances[0].remainingDays).toBe(7);
  });
});
