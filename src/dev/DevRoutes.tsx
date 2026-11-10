import { lazy, Suspense, type ReactNode } from "react";
import { Routes, Route } from "react-router-dom";

/**
 * Dev-only scratch pages for trying components out. They are not part of the product
 * surface and are deliberately not behind `ProtectedRoute`.
 *
 * `App.tsx` reaches this module through a single lazy import that only exists on the
 * `import.meta.env.DEV` branch. Vite folds that constant to `false` in a production
 * build, so Rollup drops the branch, this module, and every chunk it references —
 * nothing here is emitted to `dist/`.
 *
 * Paths are relative to the `/dev/*` route that renders this component.
 */
const Reference = lazy(() => import("./Reference"));
const ApiPlayground = lazy(() => import("./ApiPlayground"));
const TempModalsAdminDash = lazy(() => import("./TempModalsAdminDashPage"));
const TempModalsLeaveOverview = lazy(() => import("./TempModalsLeaveOverviewPage"));
const TempNewGatheringBox = lazy(() => import("./TempNewGatheringBoxPage"));

const wrap = (element: ReactNode) => <Suspense fallback={null}>{element}</Suspense>;

const DevRoutes = () => (
  <Routes>
    <Route path="reference" element={wrap(<Reference />)} />
    <Route path="api-playground" element={wrap(<ApiPlayground />)} />
    <Route path="modals/admin-dash" element={wrap(<TempModalsAdminDash />)} />
    <Route path="modals/leave-overview" element={wrap(<TempModalsLeaveOverview />)} />
    <Route path="gathering-box" element={wrap(<TempNewGatheringBox />)} />
  </Routes>
);

export default DevRoutes;
