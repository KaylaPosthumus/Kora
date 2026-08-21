import React from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { ConfigProvider, theme } from "antd";
import dayjs from "dayjs";
import "dayjs/locale/en";
import Navigation from "./components/Navigation";
import "antd/dist/reset.css";
import "./styles/table.css";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";

// Configure day.js
dayjs.locale("en");

// Import all pages
import Login from "./pages/auth/Login";
import EmployeeSignUp from "./pages/auth/EmployeeSignUp";
import AdminSignUp from "./pages/auth/AdminSignUp";
import EmployeeHome from "./pages/employee/EmployeeHome";
import EmployeeLeaveOverview from "./pages/employee/EmployeeLeaveOverview";
import EmployeeProfile from "./pages/employee/EmployeeProfile";
import EmployeeMeetings from "./pages/employee/EmployeeMeetings";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminEmployeeManagement from "./pages/admin/AdminEmployeeManagement";
import AdminCreateEmployee from "./pages/admin/AdminCreateEmployee";
import AdminIndividualEmployee from "./pages/admin/AdminIndividualEmployee";
import AdminEquipmentManagement from "./pages/admin/AdminEquipmentManagement";
import AdminLeaveRequests from "./pages/admin/AdminLeaveRequests";
import AdminMeetings from "./pages/admin/AdminMeetings";

// TODO: Delete these later
import ReferencePage from "./pages/Reference";
import TempModalsLeaveOverviewPage from "./pages/TempModalsLeaveOverviewPage";
import TempModalsAdminDashPage from "./pages/TempModalsAdminDashPage";
import ApiPlayground from "./pages/apiPlayground/ApiPlayground";
import TempNewGatheringBoxPage from "./pages/TempNewGatheringBoxPage";

const adminOnly = (element: React.ReactNode) => (
  <ProtectedRoute requires="admin">{element}</ProtectedRoute>
);

const employeeOnly = (element: React.ReactNode) => (
  <ProtectedRoute requires="employee">{element}</ProtectedRoute>
);

const AppContent: React.FC = () => {
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

          {/* Temporary Reference Route */}
          {/* TODO: Delete this later */}
          <Route path="/reference" element={<ReferencePage />} />
          <Route path="/temp-modals/leave-overview" element={<TempModalsLeaveOverviewPage />} />
          <Route path="/temp-modals/admin-dash" element={<TempModalsAdminDashPage />} />
          <Route path="/apiplayground" element={<ApiPlayground />} />
          <Route path="/temp-new-gathering-box" element={<TempNewGatheringBoxPage />} />
        </Routes>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          // Primary Colors
          colorPrimary: "#88A764",
          colorPrimaryHover: "#6D8650",
          colorPrimaryActive: "#52643C",
          colorPrimaryText: "#1B2114",
          colorPrimaryTextHover: "#1B2114",
          colorPrimaryTextActive: "#1B2114",

          // Text Colors
          colorText: "#18181b", // zinc-900
          colorTextSecondary: "#71717a", // zinc-500
          colorTextTertiary: "#a1a1aa", // zinc-400

          // Background Colors
          colorBgContainer: "#fafaf9", // warmstone-50
          colorBgElevated: "#f5f5f4", // warmstone-100
          colorBgLayout: "#e7e5e4", // warmstone-200

          // Border Colors
          colorBorder: "#d4d4d8", // zinc-300
          colorBorderSecondary: "#e4e4e7", // zinc-200

          // Component Specific
          borderRadius: 16, // rounded-2xl
          borderRadiusLG: 24,
          borderRadiusSM: 8,
          borderRadiusXS: 4,

          // Font
          fontFamily: "Inter, sans-serif",
          fontSize: 16,
          fontWeightStrong: 600,

          // Control
          controlHeight: 40,
          controlHeightLG: 48,
          controlHeightSM: 32,
          controlPaddingHorizontal: 16,
          controlPaddingHorizontalSM: 12,

          // Layout
          margin: 16,
          marginLG: 24,
          marginSM: 12,
          marginXS: 8,
          marginXXS: 4,
          padding: 16,
          paddingLG: 24,
          paddingSM: 12,
          paddingXS: 8,
          paddingXXS: 4,
        },
        // Components
        components: {
          Button: {
            borderRadius: 8,
            controlHeight: 40,
            controlHeightLG: 48,
            controlHeightSM: 32,
            paddingInline: 16,
            paddingBlock: 8,
            lineHeight: 1.5,
          },
          DatePicker: {
            borderRadius: 8,
            controlHeight: 40,
            paddingBlock: 8,
            paddingInline: 12,
            lineHeight: 1.5,
          },
          Modal: {
            borderRadiusLG: 32,
            paddingContentHorizontal: 32,
            paddingContentVertical: 24,
            titleFontSize: 24,
            lineHeight: 1.5,
          },
          Card: {
            borderRadius: 16,
            padding: 24,
            lineHeight: 1.5,
          },
          Typography: {
            margin: 0,
            padding: 0,
          },
          Form: {
            labelFontSize: 12,
            labelColor: "#71717a", // zinc-500
            verticalLabelPadding: 2,
            fontSize: 12,
          },
          Input: {
            borderRadius: 8,
            controlHeight: 48,
          },
          Select: {
            borderRadius: 8,
            controlHeight: 48,
            borderRadiusLG: 8,
          },
          Dropdown: {
            borderRadiusLG: 16,
          },
          Table: {
            colorBgSolidHover: "#e7e5e4",
            borderRadiusLG: 16,
            headerBg: "#e7e5e4",
            headerBorderRadius: 16,
            headerSplitColor: "transparent",
            headerColor: "#71717a",
            headerFilterHoverBg: "transparent",
            headerSortActiveBg: "transparent",
            headerSortHoverBg: "transparent",
          },
        },
      }}
    >
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ConfigProvider>
  );
};

export default App;
