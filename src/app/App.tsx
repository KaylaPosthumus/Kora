import React from "react";
import "antd/dist/reset.css";
import "@/styles/table.css";
import Providers from "./providers";
import AppRoutes from "./router";
import "@/shared/lib/dayjs";

/**
 * The application shell, and nothing domain-specific.
 *
 * This file used to be 247 lines: the theme, the provider stack and the route
 * table all in one. Each now has its own module — `theme.ts`, `providers.tsx`,
 * `router.tsx` — and what is left is the composition.
 */
const App: React.FC = () => (
  <Providers>
    <AppRoutes />
  </Providers>
);

export default App;
