import React from "react";
import { Navigate } from "react-router-dom";
import { Spin } from "antd";
import { useAuth } from "../../contexts/AuthContext";

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

  if (requires === "admin" && !isAdmin) return <Navigate to="/employee/home" replace />;
  if (requires === "employee" && !isEmployee) return <Navigate to="/admin/dashboard" replace />;

  return <>{children}</>;
};

export default ProtectedRoute;
