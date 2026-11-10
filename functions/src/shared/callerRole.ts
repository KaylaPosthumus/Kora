/**
 * Deciding whether a callable's caller is an admin.
 *
 * This has to agree with `firestore.rules`, or the same user is an admin to a
 * rule and not to a function. The rules read:
 *
 * ```
 * function isAdmin() {
 *   return signedIn() && (
 *     request.auth.token.role == 'admin' ||
 *     (exists(users/$(uid)) && userDoc().role == 'admin')
 *   );
 * }
 * ```
 *
 * Note the `||`: the claim and the document are alternatives, not a precedence
 * order. A just-promoted admin whose ID token still says `employee` is an admin
 * by the document, and a user demoted in Firestore is still an admin by their
 * unrefreshed claim until it rotates. {@link isCallerAdmin} reproduces both
 * halves deliberately rather than picking the "better" source.
 *
 * The claim is checked first purely so the common case costs no document read.
 */

export const ADMIN_ROLE = "admin";

/**
 * Whether the caller holds the admin role, by claim or by user document.
 *
 * @param tokenRole `request.auth.token.role`, whatever type it arrives as
 * @param readDocRole reads `users/{uid}.role`; called only when the claim misses
 */
export const isCallerAdmin = async (
  tokenRole: unknown,
  readDocRole: () => Promise<unknown>
): Promise<boolean> => {
  if (tokenRole === ADMIN_ROLE) return true;
  return (await readDocRole()) === ADMIN_ROLE;
};
