/**
 * The callable wrapper's job is to stop a second error convention entering the
 * app: a rejected `HttpsError` has to come out as the same `{ data, status }`
 * envelope every other call returns, or as a typed error carrying both.
 *
 * The distinction these tests pin is the one that is easy to get backwards. A
 * function *answering* "forbidden" or "wrong-code" is a result — it resolves,
 * and the screen tells the user which refusal it was. Only the transport failing
 * is an error.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { FirebaseError } from "firebase/app";

const callFn = vi.fn();
vi.mock("firebase/functions", () => ({
  httpsCallable: () => callFn,
  getFunctions: () => ({ __fake: "functions" }),
}));
vi.mock("@/services/firebase", async () => (await import("@/test/firebaseApp")).firebaseAppModule());

beforeEach(() => {
  vi.resetModules();
  callFn.mockReset();
});

const load = async () => await import("@/shared/lib/callable");

describe("a call that succeeds", () => {
  it("wraps the payload in the app's envelope", async () => {
    callFn.mockResolvedValue({ data: { status: "ok", before: 10, after: 12, delta: 2 } });
    const { callable } = await load();

    const result = await callable<{ id: string }, { status: string }>("adjustLeaveBalance")({
      id: "e1",
    });

    expect(result.status).toBe(200);
    expect(result.data).toEqual({ status: "ok", before: 10, after: 12, delta: 2 });
  });

  it("passes the payload through untouched", async () => {
    callFn.mockResolvedValue({ data: {} });
    const { callable } = await load();

    await callable("adjustLeaveBalance")({ employeeId: "e1", mode: "delta", days: -2 });

    expect(callFn).toHaveBeenCalledWith({ employeeId: "e1", mode: "delta", days: -2 });
  });

  it("treats a refusal as data, not an error", async () => {
    // The backend answers `forbidden` rather than raising permission-denied, so
    // this must resolve — the screen needs to say which refusal it was.
    callFn.mockResolvedValue({ data: { status: "forbidden" } });
    const { callable } = await load();

    const result = await callable("adjustLeaveBalance")({});

    expect(result.status).toBe(200);
    expect(result.data).toEqual({ status: "forbidden" });
  });
});

describe("a call that fails", () => {
  it("maps the HttpsError code onto a numeric status", async () => {
    callFn.mockRejectedValue(new FirebaseError("functions/unauthenticated", "Sign in first."));
    const { callable, CallableError } = await load();

    const failure = await callable("adjustLeaveBalance")({}).catch((error) => error);

    expect(failure).toBeInstanceOf(CallableError);
    expect(failure.code).toBe("unauthenticated");
    expect(failure.status).toBe(401);
    expect(failure.message).toContain("Sign in first.");
  });

  it("strips the functions/ prefix the SDK adds", async () => {
    callFn.mockRejectedValue(new FirebaseError("functions/permission-denied", "No."));
    const { callable } = await load();

    const failure = await callable("adjustLeaveBalance")({}).catch((error) => error);

    expect(failure.code).toBe("permission-denied");
    expect(failure.status).toBe(403);
  });

  it("falls back to 500 for a code it does not know", async () => {
    callFn.mockRejectedValue(new FirebaseError("functions/teapot", "?"));
    const { callable } = await load();

    const failure = await callable("adjustLeaveBalance")({}).catch((error) => error);

    expect(failure.status).toBe(500);
  });

  it("survives a rejection that is not a FirebaseError at all", async () => {
    // A network stack failing mid-flight does not necessarily raise one.
    callFn.mockRejectedValue(new TypeError("Failed to fetch"));
    const { callable, CallableError } = await load();

    const failure = await callable("adjustLeaveBalance")({}).catch((error) => error);

    expect(failure).toBeInstanceOf(CallableError);
    expect(failure.code).toBe("internal");
    expect(failure.status).toBe(500);
  });
});
