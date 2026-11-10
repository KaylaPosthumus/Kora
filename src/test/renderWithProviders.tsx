/**
 * Render helper for flow tests.
 *
 * A page under test needs a router (every screen uses `useNavigate` or `Link`)
 * and usually the auth context (`ProtectedRoute` and the nav read it). Wiring
 * both up by hand in each test buries the flow being tested, so this does it
 * once.
 *
 * `AuthProvider` is the real one — it subscribes to `onAuthStateChanged` and
 * reads `users/{uid}` through `authService`. A test that uses it must therefore
 * mock `firebase/auth` and `src/services/firebase.ts` (see `firebaseApp.ts`) and
 * seed the user document (see `firestore.ts`). That is deliberate: a flow test
 * that stubbed the context would not exercise the guard logic that decides where
 * a signed-in user lands, which is the part worth testing.
 *
 * ```tsx
 * const { currentPath } = renderWithProviders(<App />, { route: "/admin/dashboard" });
 * await waitFor(() => expect(currentPath()).toBe("/employee/home"));
 * ```
 */

import React from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { AuthProvider } from "@/contexts/AuthContext";

interface Options extends Omit<RenderOptions, "wrapper"> {
  /** Initial history entry. Include the hash when it matters — `/#notlinked`. */
  route?: string;
  /** Set false to render without the auth context (a leaf component in isolation). */
  withAuth?: boolean;
}

export interface ProvidersRenderResult extends RenderResult {
  /** Pathname + search + hash the router is currently on. */
  currentPath: () => string;
}

/** Mirrors the router's location into a ref so assertions can read it. */
const LocationProbe: React.FC<{ into: { current: string } }> = ({ into }) => {
  const location = useLocation();
  into.current = `${location.pathname}${location.search}${location.hash}`;
  return null;
};

export const renderWithProviders = (
  ui: React.ReactNode,
  { route = "/", withAuth = true, ...options }: Options = {}
): ProvidersRenderResult => {
  const location = { current: route };

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <MemoryRouter initialEntries={[route]}>
      <LocationProbe into={location} />
      {withAuth ? <AuthProvider>{children}</AuthProvider> : children}
    </MemoryRouter>
  );

  const result = render(<>{ui}</>, { wrapper: Wrapper, ...options });

  return Object.assign(result, { currentPath: () => location.current });
};

export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
