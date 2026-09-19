import React, { lazy, Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { Spin } from "antd";
import Navigation from "@/shared/components/Navigation";
import { ProtectedRoute } from "@/features/auth/components";
import ErrorBoundary from "@/shared/components/ErrorBoundary";

/**
 * Login is imported eagerly; every other screen is split out.
 *
 * It is the landing route — making it lazy would cost a second round trip before
 * anyone can even see the form. Everything behind it is loaded on navigation, so
 * an employee on a phone no longer downloads the seven admin screens they cannot
 * open, and an admin does not pay for the employee screens either.
 *
 * Each `import()` below becomes its own chunk. Splitting per screen rather than
 * per role is what keeps a chunk from being a second bundle: the pages already
 * share their heavy dependencies through the vendor chunks in `vite.config.ts`.
 */
import Login from "@/features/auth/pages/Login";

const EmployeeSignUp = lazy(() => import("@/features/auth/pages/EmployeeSignUp"));
const AdminSignUp = lazy(() => import("@/features/auth/pages/AdminSignUp"));
const EmployeeHome = lazy(() => import("@/features/dashboard/pages/EmployeeHome"));
const EmployeeLeaveOverview = lazy(
  () => import("@/features/leave/pages/EmployeeLeaveOverview")
);
const EmployeeProfile = lazy(() => import("@/features/employees/pages/EmployeeProfile"));
const EmployeeMeetings = lazy(() => import("@/features/gatherings/pages/EmployeeMeetings"));
const AdminDashboard = lazy(() => import("@/features/dashboard/pages/AdminDashboard"));
const AdminEmployeeManagement = lazy(
  () => import("@/features/employees/pages/AdminEmployeeManagement")
);
const AdminCreateEmployee = lazy(
  () => import("@/features/employees/pages/AdminCreateEmployee")
);
const AdminIndividualEmployee = lazy(
  () => import("@/features/employees/pages/AdminIndividualEmployee")
);
const AdminEquipmentManagement = lazy(
  () => import("@/features/equipment/pages/AdminEquipmentManagement")
);
const AdminLeaveRequests = lazy(() => import("@/features/leave/pages/AdminLeaveRequests"));
const AdminMeetings = lazy(() => import("@/features/gatherings/pages/AdminMeetings"));
const NotFound = lazy(() => import("./NotFound"));

// Dev-only scratch pages. Vite folds `import.meta.env.DEV` to `false` in a production
// build, so Rollup drops this branch along with the module and chunks behind it —
// verified by the absence of any dev chunk in `dist/assets`.
const DevRoutes = import.meta.env.DEV ? lazy(() => import("@/dev/DevRoutes")) : null;

/** Shown while a route's chunk is in flight. */
const RouteFallback: React.FC = () => (
  <div className="flex items-center justify-center w-full h-full min-h-[50vh]">
    <Spin size="large" />
  </div>
);

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
          {/* One boundary for every lazy route. It sits inside <main>, so the
              navigation stays put while a screen's chunk arrives. */}
          <Suspense fallback={<RouteFallback />}>
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
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
};

export default AppRoutes;
