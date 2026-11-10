/**
 * What to remove when a Firebase Auth account is deleted.
 *
 * Deleting an auth user does not touch Firestore. Without this, a deleted
 * account leaves behind `users/{uid}` — which holds the person's full name,
 * email address and role — plus the two side records this backend keeps for
 * them. Those documents are unreachable (nothing can sign in as that uid again)
 * but very much still there, and `userAPI.getUnlinkedUsers` will happily list a
 * ghost for an admin to link.
 *
 * The employee record is deliberately **not** deleted. It carries salary,
 * employment dates and equipment assignments that outlive a login, and
 * `onEmployeeDeleted` exists for when an employee really is being removed.
 * Here the record is only unlinked from the vanished account.
 */

/**
 * Documents keyed by uid that this backend owns.
 *
 * `emailVerifications` was here until email verification was dropped. The list
 * stays plural-shaped rather than collapsing to one string: it is the reason
 * this module exists, and the next uid-keyed collection belongs in it.
 */
export const UID_KEYED_COLLECTIONS = [
  /** Written by syncRoleClaim. */
  "userClaims",
] as const;

export interface UserCleanupBackend {
  /** The user document, or undefined if there is none. */
  readUser(uid: string): Promise<{ employeeId?: unknown } | undefined>;
  deleteUserDoc(uid: string): Promise<void>;
  /** Deletes `{collection}/{uid}`; a no-op when the document is absent. */
  deleteByUid(collection: string, uid: string): Promise<void>;
  /** Clears the employee record's pointer at the vanished account. */
  unlinkEmployee(employeeId: string): Promise<void>;
}

export interface UserCleanupReport {
  userDocDeleted: boolean;
  /** The employee record unlinked, if there was one. */
  employeeUnlinked: string | null;
  /** Uid-keyed collections cleaned. */
  sideRecordsCleared: string[];
}

/**
 * Cleans up after a deleted auth account.
 *
 * The side records are cleared whether or not a user document existed: a signup
 * that requested a verification code and was then deleted before the user
 * document landed would otherwise leave a stray challenge behind.
 */
export const cleanUpDeletedUser = async (
  uid: string,
  backend: UserCleanupBackend,
  collections: readonly string[] = UID_KEYED_COLLECTIONS
): Promise<UserCleanupReport> => {
  // Read before deleting — the employee id is only on the document that is
  // about to go.
  const user = await backend.readUser(uid);

  const employeeId =
    typeof user?.employeeId === "string" && user.employeeId.length > 0
      ? user.employeeId
      : null;

  if (employeeId !== null) await backend.unlinkEmployee(employeeId);

  if (user !== undefined) await backend.deleteUserDoc(uid);

  for (const collection of collections) {
    await backend.deleteByUid(collection, uid);
  }

  return {
    userDocDeleted: user !== undefined,
    employeeUnlinked: employeeId,
    sideRecordsCleared: [...collections],
  };
};
