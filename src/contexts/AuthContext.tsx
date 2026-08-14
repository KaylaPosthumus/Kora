import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../services/firebase";
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
