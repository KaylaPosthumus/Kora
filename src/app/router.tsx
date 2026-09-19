import React, { lazy, Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Navigation from "@/components/Navigation";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";

import Login from "@/pages/auth/Login";
import EmployeeSignUp from "@/pages/auth/EmployeeSignUp";
import AdminSignUp from "@/pages/auth/AdminSignUp";
import EmployeeHome from "@/pages/employee/EmployeeHome";
import EmployeeLeaveOverview from "@/pages/employee/EmployeeLeaveOverview";
import EmployeeProfile from "@/pages/employee/EmployeeProfile";
import EmployeeMeetings from "@/pages/employee/EmployeeMeetings";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminEmployeeManagement from "@/pages/admin/AdminEmployeeManagement";
import AdminCreateEmployee from "@/pages/admin/AdminCreateEmployee";
import AdminIndividualEmployee from "@/pages/admin/AdminIndividualEmployee";
import AdminEquipmentManagement from "@/pages/admin/AdminEquipmentManagement";
import AdminLeaveRequests from "@/pages/admin/AdminLeaveRequests";
import AdminMeetings from "@/pages/admin/AdminMeetings";
import NotFound from "@/pages/NotFound";

// Dev-only scratch pages. Vite folds `import.meta.env.DEV` to `false` in a production
// build, so Rollup drops this branch along with the module and chunks behind it —
// verified by the absence of any dev chunk in `dist/assets`.
const DevRoutes = import.meta.env.DEV ? lazy(() => import("@/dev/DevRoutes")) : null;

const adminOnly = (element: React.ReactNode) => (
  <ProtectedRoute requires="admin">{element}</ProtectedRoute>
);

const employeeOnly = (element: React.ReactNode) => (
  <ProtectedRoute requires="employee">{element}</ProtectedRoute>
);

/**
 * The routed shell: the navigation, the page frame, and the route table.
 *
 * Route elements are imported eagerly, which is why the production bundle is one
 * chunk. Phase 6 turns these into `React.lazy` calls — this file is the seam that
 * makes that a local change.
 *
 * The error boundary sits inside `<main>` rather than around the whole tree on
 * purpose: a page that throws leaves the navigation rendered, so the user can
 * navigate away instead of facing a blank screen.
 */
const AppRoutes: React.FC = () => {
  const location = useLocation();

  const isAuthPage =
    location.pathname === "/" ||
    location.pathname === "/employee/signup" ||
    location.pathname === "/admin/signup";

  return (
    <div className="flex h-screen lg:mr-4">
      {!isAuthPage && <Navigation />}
      {/* Below lg the nav is a fixed top bar plus a bottom nav, so the page has
          to leave room for both. On lg and up the sidebar is in flow and the
          padding goes away. */}
      <main
        className={`flex-grow-1 min-w-0 ${
          isAuthPage ? "" : "pt-14 pb-16 lg:pt-0 lg:pb-0"
        }`}
      >
        <ErrorBoundary>
          <Routes>
            {/* Auth Routes */}
            <Route path="/" element={<Login />} />
            <Route path="/employee/signup" element={<EmployeeSignUp />} />
            <Route path="/admin/signup" element={<AdminSignUp />} />

            {/* Employee Routes */}
            <Route path="/employee/home" element={employeeOnly(<EmployeeHome />)} />
            <Route
              path="/employee/leave-overview"
              element={employeeOnly(<EmployeeLeaveOverview />)}
            />
            <Route path="/employee/profile" element={employeeOnly(<EmployeeProfile />)} />
            <Route path="/employee/meetings" element={employeeOnly(<EmployeeMeetings />)} />

            {/* Admin Routes */}
            <Route path="/admin/dashboard" element={adminOnly(<AdminDashboard />)} />
            <Route path="/admin/employees" element={adminOnly(<AdminEmployeeManagement />)} />
            <Route path="/admin/equipment" element={adminOnly(<AdminEquipmentManagement />)} />
            <Route path="/admin/create-employee" element={adminOnly(<AdminCreateEmployee />)} />
            <Route
              path="/admin/individual-employee/:employeeId?"
              element={adminOnly(<AdminIndividualEmployee />)}
            />
            <Route path="/admin/leave-requests" element={adminOnly(<AdminLeaveRequests />)} />
            <Route path="/admin/meetings" element={adminOnly(<AdminMeetings />)} />

            {/* Dev-only scratch pages — stripped from production builds */}
            {DevRoutes && (
              <Route
                path="/dev/*"
                element={
                  <Suspense fallback={null}>
                    <DevRoutes />
                  </Suspense>
                }
              />
            )}

            {/* Anything unmatched */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  );
};

export default AppRoutes;
