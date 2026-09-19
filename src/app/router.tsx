import React, { lazy, Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Navigation from "@/shared/components/Navigation";
import { ProtectedRoute } from "@/features/auth/components";
import ErrorBoundary from "@/shared/components/ErrorBoundary";

import Login from "@/features/auth/pages/Login";
import EmployeeSignUp from "@/features/auth/pages/EmployeeSignUp";
import AdminSignUp from "@/features/auth/pages/AdminSignUp";
import EmployeeHome from "@/features/dashboard/pages/EmployeeHome";
import EmployeeLeaveOverview from "@/features/leave/pages/EmployeeLeaveOverview";
import EmployeeProfile from "@/features/employees/pages/EmployeeProfile";
import EmployeeMeetings from "@/features/gatherings/pages/EmployeeMeetings";
import AdminDashboard from "@/features/dashboard/pages/AdminDashboard";
import AdminEmployeeManagement from "@/features/employees/pages/AdminEmployeeManagement";
import AdminCreateEmployee from "@/features/employees/pages/AdminCreateEmployee";
import AdminIndividualEmployee from "@/features/employees/pages/AdminIndividualEmployee";
import AdminEquipmentManagement from "@/features/equipment/pages/AdminEquipmentManagement";
import AdminLeaveRequests from "@/features/leave/pages/AdminLeaveRequests";
import AdminMeetings from "@/features/gatherings/pages/AdminMeetings";
import NotFound from "./NotFound";

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
