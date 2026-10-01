/**
 * Driving `firestore.rules` against the Firestore emulator.
 *
 * There is no backend, so these rules are the whole of Kora's access control —
 * and until now they had no tests. The two bugs that prompted this suite were
 * both invisible to any test that did not run the real rules engine:
 * `request.auth.token.suspended` and `request.auth.token.role` were read by dot
 * access, which *errors* rather than returning null when the claim is absent,
 * and an error aborts the surrounding expression — including the other half of
 * an `||`. Every employee write was denied, and the document fallback in
 * `isAdmin()` could never run.
 *
 * **No Firebase SDK.** Two emulator behaviours make that unnecessary, and they
 * are what keeps this package's dependency list at "vitest":
 *
 * 1. It accepts an **unsigned** JWT (`alg: "none"`, empty signature). Custom
 *    claims are then just fields in the payload, which is the only way to write
 *    the claim-present and claim-absent cases side by side — the thing that
 *    actually needed testing.
 * 2. `Authorization: Bearer owner` bypasses rules entirely, so fixtures can be
 *    seeded without the rules under test getting a say in it.
 *
 * Both are emulator-only affordances. Nothing here reaches a real project.
 */

import { afterAll, beforeEach } from "vitest";

/** Always a `demo-` project: it forces the emulator's offline mode. */
const PROJECT = process.env.GCLOUD_PROJECT ?? "demo-kora";
const HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";

const ROOT = `http://${HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;
const ADMIN_ROOT = `http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`;

/** The outcome of an attempted operation. Compared with `toBe` in tests. */
export const ALLOW = "ALLOW";
export const DENY = "DENY";
export type Outcome = typeof ALLOW | typeof DENY;

// Encoding -----------------------------------------------------------------

/** A Firestore REST `Value`. */
type Value = Record<string, unknown>;

/**
 * A JS value as the REST API's tagged union.
 *
 * Deliberately narrow: these tests write fixtures, not real payloads, so the
 * types Kora actually stores (string, number, boolean, null, array, map) are
 * the whole of it. Anything else throws rather than silently encoding wrong —
 * a fixture that does not say what the test thinks it says is worse than a
 * failure.
 */
const encode = (value: unknown): Value => {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encode) } };
  }
  if (typeof value === "object") {
    return { mapValue: { fields: encodeFields(value as Record<string, unknown>) } };
  }
  throw new TypeError(`rules-tests cannot encode a ${typeof value} fixture value`);
};

const encodeFields = (data: Record<string, unknown>): Record<string, Value> =>
  Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encode(value)]));

// Identity -----------------------------------------------------------------

/** A caller: a uid plus whatever custom claims their ID token carries. */
export interface Caller {
  uid: string;
  /**
   * Custom claims. **Omitting a key is the point** — an absent claim is the
   * normal state before `syncRoleClaim` has run and the user's token has
   * refreshed, and it is the case both live bugs lived in.
   */
  claims?: Record<string, unknown>;
}

const base64url = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

/**
 * An unsigned ID token the emulator accepts.
 *
 * The signature is empty and the algorithm is `none`. A real Firebase project
 * rejects this out of hand, which is exactly why it is safe to have in a repo:
 * it is worthless anywhere but against a local emulator.
 */
const idToken = ({ uid, claims = {} }: Caller): string => {
  const header = { alg: "none", type: "JWT" };
  const payload = {
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    sub: uid,
    user_id: uid,
    auth_time: 1,
    iat: 1,
    exp: 9_999_999_999,
    firebase: { sign_in_provider: "password", identities: {} },
    ...claims,
  };
  return `${base64url(header)}.${base64url(payload)}.`;
};

/** The header set for a caller, or for the rules-bypassing owner. */
const authHeaders = (caller: Caller | "owner"): Record<string, string> => ({
  Authorization: `Bearer ${caller === "owner" ? "owner" : idToken(caller)}`,
  "Content-Type": "application/json",
});

// Operations ---------------------------------------------------------------

/**
 * Whether a response means the rules allowed the operation.
 *
 * A 404 counts as ALLOW on a read: the rules permitted the read and there was
 * simply nothing there. Conflating "denied" with "absent" would let a test pass
 * against a rule that never ran.
 */
const outcome = (status: number): Outcome =>
  status === 403 || status === 401 ? DENY : ALLOW;

/** The operations a test can attempt as a given caller. */
export interface As {
  /** Create or overwrite a document. */
  set(path: string, data: Record<string, unknown>): Promise<Outcome>;
  /** Write only the named fields, leaving the rest of the document alone. */
  update(
    path: string,
    data: Record<string, unknown>,
    fields?: readonly string[]
  ): Promise<Outcome>;
  get(path: string): Promise<Outcome>;
  remove(path: string): Promise<Outcome>;
  /** A `where field == value` query over a top-level collection. */
  query(collection: string, field: string, value: unknown): Promise<Outcome>;
}

const request = async (
  caller: Caller | "owner",
  method: string,
  url: string,
  body?: unknown
): Promise<number> => {
  const response = await fetch(url, {
    method,
    headers: authHeaders(caller),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  // Drain the body so the socket is released between tests.
  await response.text();
  return response.status;
};

/**
 * The operations available to one caller.
 *
 * `update` sends an explicit `updateMask`, because without one a PATCH is a
 * full overwrite — and the rules draw a real distinction there. `onlyChanges()`
 * compares the incoming document against the stored one, so an unmasked PATCH
 * that happens to omit a field reads as *clearing* it, and a test meaning "the
 * employee edits their phone number" would silently be testing "the employee
 * deletes their salary".
 */
export const as = (caller: Caller): As => ({
  set: (path, data) =>
    request(caller, "PATCH", `${ROOT}/${path}`, { fields: encodeFields(data) }).then(
      outcome
    ),

  update: (path, data, fields) => {
    const mask = (fields ?? Object.keys(data))
      .map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`)
      .join("&");
    return request(caller, "PATCH", `${ROOT}/${path}?${mask}`, {
      fields: encodeFields(data),
    }).then(outcome);
  },

  get: (path) => request(caller, "GET", `${ROOT}/${path}`).then(outcome),

  remove: (path) => request(caller, "DELETE", `${ROOT}/${path}`).then(outcome),

  query: (collection, field, value) =>
    request(caller, "POST", `${ROOT}:runQuery`, {
      structuredQuery: {
        from: [{ collectionId: collection }],
        where: {
          fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: encode(value) },
        },
      },
    }).then(outcome),
});

// Fixtures -----------------------------------------------------------------

/**
 * Writes a fixture document as the owner, bypassing the rules under test.
 *
 * Seeding through the rules would make every fixture depend on the thing being
 * tested — and a rules bug would then show up as an unrelated test failing to
 * set itself up, rather than as the assertion it belongs to.
 */
export const seed = async (path: string, data: Record<string, unknown>): Promise<void> => {
  const status = await request("owner", "PATCH", `${ROOT}/${path}`, {
    fields: encodeFields(data),
  });
  if (status >= 300) {
    throw new Error(`seeding ${path} failed with ${status}`);
  }
};

/** Empties the database. */
export const clear = async (): Promise<void> => {
  const response = await fetch(ADMIN_ROOT, { method: "DELETE" });
  await response.text();
  if (!response.ok) {
    throw new Error(`clearing the emulator failed with ${response.status}`);
  }
};

/**
 * Fails loudly if the emulator is not up.
 *
 * Without this, every assertion fails on a fetch error and the output says
 * nothing about the actual cause.
 */
const assertEmulator = async (): Promise<void> => {
  try {
    const response = await fetch(`http://${HOST}/`);
    await response.text();
  } catch {
    throw new Error(
      `No Firestore emulator at ${HOST}.\n` +
        `Run these tests through the emulator: npm run test:rules (from the repo root).\n` +
        `The emulator needs Java 21+ — see CLAUDE.md.`
    );
  }
};

/**
 * Per-file setup: clear the database before each test.
 *
 * Before rather than after, so a failing test leaves its data in place to be
 * inspected. `fileParallelism` is off in the Vitest config, or one file's clear
 * would wipe another's fixtures mid-run.
 */
export const useEmulator = (): void => {
  beforeEach(async () => {
    await assertEmulator();
    await clear();
  });

  afterAll(async () => {
    await clear();
  });
};
