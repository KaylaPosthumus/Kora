import React from "react";
import { BrowserRouter as Router } from "react-router-dom";
import { ConfigProvider } from "antd";
import { AuthProvider } from "@/contexts/AuthContext";
import { koraTheme } from "./theme";

/**
 * Everything the app is wrapped in, in the order it has to be wrapped.
 *
 * `AuthProvider` sits inside `ConfigProvider` so that anything it renders while
 * resolving the session is already themed, and outside `Router` because the
 * session outlives any route.
 */
const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ConfigProvider theme={koraTheme}>
    <AuthProvider>
      <Router>{children}</Router>
    </AuthProvider>
  </ConfigProvider>
);

export default Providers;
