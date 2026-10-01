/**
 * Calling a Cloud Function without letting a second error convention into the app.
 *
 * Every read and write in a feature's `api` module returns `{ data, status }` — the shape
 * the screens have destructured since the axios days. Callables do not: they
 * resolve with a bare payload and *reject* with an `HttpsError` carrying a string
 * code. Left alone, that would mean two error styles in one data layer, and every
 * call site wrapped in its own try/catch.
 *
 * So a rejection is translated here into the same envelope, with the code mapped
 * onto the numeric status the rest of the layer already uses.
 */

import { httpsCallable, type HttpsCallableResult } from "firebase/functions";
import { FirebaseError } from "firebase/app";
import { functions } from "@/services/firebase";
import type { ApiResponse } from "./firestore";

/**
 * `HttpsError` codes, as the numeric statuses the screens branch on.
 *
 * The functions in `functions/src` mostly do not throw these — they return a
 * verdict object and let the caller decide, which is why `adjustLeaveBalance`
 * answers `{ status: "forbidden" }` rather than raising `permission-denied`. What
 * lands here is the transport failing, or a caller reaching a function while
 * signed out.
 */
const STATUS_FOR: Record<string, number> = {
  ok: 200,
  cancelled: 499,
  "invalid-argument": 400,
  "deadline-exceeded": 504,
  "not-found": 404,
  "already-exists": 409,
  "permission-denied": 403,
  "resource-exhausted": 429,
  "failed-precondition": 412,
  aborted: 409,
  "out-of-range": 400,
  unimplemented: 501,
  internal: 500,
  unavailable: 503,
  "data-loss": 500,
  unauthenticated: 401,
};

/** The code off a rejected callable, whatever shape the SDK raised. */
const codeOf = (error: unknown): string => {
  if (error instanceof FirebaseError) {
    // Callable errors arrive prefixed — "functions/permission-denied".
    return error.code.replace(/^functions\//, "");
  }
  return "internal";
};

export class CallableError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "CallableError";
  }
}

/**
 * Wraps one callable as a function returning the app's `{ data, status }`.
 *
 * A *refusal* — the function answering "forbidden", "expired", "wrong-code" — is
 * data, not an error: it arrives as `data` with status 200, because the screen
 * has to tell the user which refusal it was. Only a genuine failure rejects, and
 * it rejects with a {@link CallableError} carrying both code and status.
 */
export const callable =
  <TRequest, TResponse>(name: string) =>
  async (payload: TRequest): Promise<ApiResponse<TResponse>> => {
    try {
      const fn = httpsCallable<TRequest, TResponse>(functions, name);
      const result: HttpsCallableResult<TResponse> = await fn(payload);
      return { data: result.data, status: 200 };
    } catch (error) {
      const code = codeOf(error);
      const status = STATUS_FOR[code] ?? 500;
      const message =
        error instanceof Error && error.message ? error.message : `${name} failed`;
      throw new CallableError(code, status, message);
    }
  };
