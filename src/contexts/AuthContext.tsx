import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import {
  getCurrentUser,
  invalidateCurrentUser,
  type CurrentUserDTO,
} from "../services/authService";
import { UserRole } from "../types/common";

interface AuthContextValue {
  /** The signed-in user, or null. Undefined-safe: null while loading too. */
  user: CurrentUserDTO | null;
  /** True until the first auth state has been resolved. */
  loading: boolean;
  isAdmin: boolean;
  isEmployee: boolean;
  /** Re-reads the users/{uid} doc — call after an admin links an account. */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * A comparable key for `userClaims/{uid}.refreshTime`.
 *
 * The watch only needs to know whether the value moved, so this normalises
 * whatever shape it arrives in — a Firestore `Timestamp`, an ISO string, a
 * number — rather than requiring one and silently ignoring the rest.
 */
const stampKey = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;

  const timestamp = value as { toMillis?: () => number };
  if (typeof timestamp.toMillis === "function") return String(timestamp.toMillis());

  if (typeof value === "string" || typeof value === "number") return String(value);

  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};

/**
 * Replaces the old manual token plumbing (`navbarUserStatus` polling the backend).
 * `onAuthStateChanged` is the single source of truth for the session.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<CurrentUserDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      invalidateCurrentUser();

      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      setUser(await getCurrentUser());
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const refresh = async () => {
    invalidateCurrentUser();
    setUser(await getCurrentUser());
  };

  /**
   * Picks up a role change the moment the backend makes one.
   *
   * `syncRoleClaim` mirrors `users/{uid}.role` into a custom claim, but a claim
   * does not reach the client until its ID token refreshes — up to an hour on
   * its own. The employee sitting in another browser when an admin links their
   * account would spend that hour taking the `get()` fallback in
   * `firestore.rules`, and would be refused outright by `storage.rules`, which
   * cannot fall back at all.
   *
   * So the function stamps `userClaims/{uid}.refreshTime` after every claim
   * change and this watches it, forcing `getIdToken(true)` when it moves.
   *
   * The first snapshot is only recorded, never acted on: the document already
   * exists from whenever the claim was last written, and refreshing a token on
   * every page load would be pure noise.
   */
  const uid = user?.userId ?? null;

  useEffect(() => {
    if (!uid) return;

    let lastSeen: string | null = null;
    let isFirstSnapshot = true;

    try {
      return onSnapshot(
        doc(db, "userClaims", uid),
        (snapshot) => {
          // Only "did this change?" matters, so compare a stable key rather
          // than insisting on a Timestamp. `serverTimestamp()` normally arrives
          // as one, but it reads back null while a write is pending, and any
          // other writer could leave an ISO string — the same shape everything
          // else in this codebase stores dates as.
          const at = stampKey(snapshot.data()?.refreshTime);

          if (isFirstSnapshot) {
            isFirstSnapshot = false;
            lastSeen = at;
            return;
          }

          if (at === null || at === lastSeen) return;
          lastSeen = at;

          void (async () => {
            try {
              // Force a token refresh, then re-read the user document: the claim
              // governs what Firestore and Storage will allow, and the document
              // governs what this app renders.
              //
              // `getIdToken` is checked rather than assumed. `?.` would only
              // guard a null currentUser, and this also runs against doubles
              // that model the parts of the SDK the app uses and no more.
              const current = auth.currentUser;
              if (typeof current?.getIdToken === "function") {
                await current.getIdToken(true);
              }
              await refresh();
            } catch (error) {
              console.warn("AuthContext: could not refresh after a claim change", error);
            }
          })();
        },
        (error) => {
          // A denied read or a missing index must not take down the session —
          // the rules' get() fallback still authorises the user correctly.
          console.warn("AuthContext: claim watch failed", error);
        }
      );
    } catch (error) {
      console.warn("AuthContext: could not watch for claim changes", error);
      return;
    }
  }, [uid]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin: user?.role === UserRole.Admin && Boolean(user?.adminId),
      isEmployee: user?.role === UserRole.Employee && Boolean(user?.employeeId),
      refresh,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return context;
};
