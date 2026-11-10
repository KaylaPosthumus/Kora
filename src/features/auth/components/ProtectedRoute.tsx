import React from "react";
import { Navigate } from "react-router-dom";
import { Spin } from "antd";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Route guard. Reads the role off the auth context instead of calling the old
 * `navbarUserStatus()` backend round-trip.
 */
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  requires: "admin" | "employee" | "any";
}> = ({ children, requires }) => {
  const { user, loading, isAdmin, isEmployee } = useAuth();

  if (loading) {
    return (
      <div className="w-full h-screen flex justify-center items-center">
        <Spin size="large" />
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;

  // Signed in but no employee/admin record yet — the login screen shows the
  // "waiting to be linked" message off this hash.
  if (!user.isLinked) return <Navigate to="/#notlinked" replace />;

  // Linked, but `role` and the matching record id disagree (role: "admin" with no
  // adminId, or a role left at "unassigned"), so neither flag is set and there is
  // no home screen to fall back to. This has to be caught *before* the two
  // redirects below: their fallbacks are each other's routes, so without it such
  // a user ping-pongs admin -> employee -> admin until the tab locks up.
  // authService returns 403 for the same state at login; a direct URL never goes
  // through that, which is how someone reaches a guard in it. Only an admin can
  // repair the record, so they get the same screen as an unlinked account.
  if (!isAdmin && !isEmployee) return <Navigate to="/#notlinked" replace />;

  // Past this point exactly one flag is true — `role` holds a single value — so
  // each redirect below lands on a route the user can actually render.
  if (requires === "admin" && !isAdmin) return <Navigate to="/employee/home" replace />;
  if (requires === "employee" && !isEmployee) return <Navigate to="/admin/dashboard" replace />;

  return <>{children}</>;
};

export default ProtectedRoute;
