/**
 * Deriving a user's custom claims from their `users/{uid}` document.
 *
 * `firestore.rules` resolves a caller's role from `request.auth.token.role` and
 * falls back to `get(/databases/$(db)/documents/users/$(uid))` when the claim is
 * absent. Since `setCustomUserClaims` was previously called only by
 * `scripts/seed.mjs`, every user created through the UI took that fallback — a
 * document read billed on every rule evaluation, on every request.
 *
 * Everything here is pure. The trigger that calls it lives in
 * `syncRoleClaim.ts`; keeping the decisions in one side-effect-free module is
 * what lets them be tested without an emulator or an Admin SDK.
 */

/** The three roles the app recognises. Mirrors `UserRole` in `src/types/common.ts`. */
export type UserRole = "unassigned" | "employee" | "admin";

const ROLES: readonly string[] = ["unassigned", "employee", "admin"];

/** The subset of a `users/{uid}` document that affects authorisation. */
export interface UserDoc {
  role?: unknown;
  employeeId?: unknown;
  adminId?: unknown;
}

/** The claims this module owns. Any other claim on the token is left alone. */
export interface RoleClaims {
  role: UserRole;
  employeeId?: string;
  adminId?: string;
}

/**
 * The keys `syncRoleClaim` manages. Listed explicitly so that
 * {@link nextClaims} can clear a stale one without disturbing a claim some
 * other system set.
 */
export const MANAGED_CLAIMS = ["role", "employeeId", "adminId"] as const;

/** A non-empty string, or undefined. Firestore nulls and stray types both fall out here. */
const asId = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

/**
 * The claims a user document implies.
 *
 * An unrecognised or missing role degrades to `unassigned` rather than throwing:
 * a malformed document should leave the user with no privileges, not wedge the
 * trigger in a retry loop. `employeeId` / `adminId` are omitted when absent so
 * the token stays small and `request.auth.token.employeeId != null` in the rules
 * means what it says.
 */
export const desiredClaims = (user: UserDoc | undefined): RoleClaims | null => {
  if (user === undefined) return null;

  const role = (
    typeof user.role === "string" && ROLES.includes(user.role) ? user.role : "unassigned"
  ) as UserRole;

  const employeeId = asId(user.employeeId);
  const adminId = asId(user.adminId);

  return {
    role,
    ...(employeeId ? { employeeId } : {}),
    ...(adminId ? { adminId } : {}),
  };
};

/**
 * The full claims object to hand `setCustomUserClaims`.
 *
 * `setCustomUserClaims` **replaces** the entire claims object rather than
 * merging, so writing only the managed keys would silently drop anything else
 * on the token. This keeps unmanaged claims and rewrites only what it owns;
 * a `null` desired (the user document was deleted) clears the managed keys and
 * keeps the rest.
 */
export const nextClaims = (
  existing: Record<string, unknown> | undefined,
  desired: RoleClaims | null
): Record<string, unknown> => {
  const result: Record<string, unknown> = { ...(existing ?? {}) };

  for (const key of MANAGED_CLAIMS) delete result[key];
  if (desired !== null) Object.assign(result, desired);

  return result;
};

/**
 * Whether the token would actually change.
 *
 * The trigger fires on every write to the user document — a changed profile
 * picture included — and `setCustomUserClaims` both costs an Admin SDK call and
 * churns the user's token. Comparing first means an unrelated edit is a no-op.
 * Key order is irrelevant, so compare on sorted entries rather than JSON.
 */
export const claimsEqual = (
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown> | undefined
): boolean => {
  const left = Object.entries(a ?? {}).sort(([x], [y]) => x.localeCompare(y));
  const right = Object.entries(b ?? {}).sort(([x], [y]) => x.localeCompare(y));

  if (left.length !== right.length) return false;
  return left.every(
    ([key, value], index) => right[index][0] === key && right[index][1] === value
  );
};
