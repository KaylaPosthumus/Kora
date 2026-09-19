import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { firestoreMock } from "../../test/firestore";
import { authMock } from "../../test/firebaseApp";
import { renderWithProviders, screen, waitFor } from "../../test/renderWithProviders";
import { ProtectedRoute } from "@/features/auth/components";
import { UserRole } from "@/shared/types/common";

/**
 * Flow test — where a signed-in user actually lands.
 *
 * There is no backend, so `ProtectedRoute` is the only thing between a URL and a
 * screen. It reads the role off `AuthContext`, which reads it off the
 * `users/{uid}` document — meaning a guard decision is three moving parts deep,
 * and none of them is exercised by testing the guard's props in isolation.
 *
 * These render the real `AuthProvider` over the fake Firebase Auth and Firestore,
 * so a test signs a uid in, seeds their user doc, and asserts on the screen that
 * comes up. `AuthProvider` resolves the session asynchronously (as Firebase
 * does), which is why every assertion waits.
 */

vi.mock("firebase/firestore", async () => (await import("../../test/firestore")).firestoreModule());
vi.mock("firebase/auth", async () => (await import("../../test/firebaseApp")).firebaseAuthModule());
vi.mock("../../services/firebase", async () => (await import("../../test/firebaseApp")).firebaseAppModule());

/** A cut-down version of the app's route table — the guards are the real ones. */
const routes = (
  <Routes>
    <Route path="/" element={<h1>Log in</h1>} />
    <Route
      path="/admin/dashboard"
      element={
        <ProtectedRoute requires="admin">
          <h1>Admin dashboard</h1>
        </ProtectedRoute>
      }
    />
    <Route
      path="/employee/home"
      element={
        <ProtectedRoute requires="employee">
          <h1>Employee home</h1>
        </ProtectedRoute>
      }
    />
    <Route
      path="/employee/profile"
      element={
        <ProtectedRoute requires="any">
          <h1>Profile</h1>
        </ProtectedRoute>
      }
    />
  </Routes>
);

const signInAsAdmin = () => {
  authMock.addAccount({ uid: "admin-uid", email: "ada@kora.test", displayName: "Ada Admin" });
  firestoreMock.seed({
    "users/admin-uid": {
      fullName: "Ada Admin",
      email: "ada@kora.test",
      role: UserRole.Admin,
      isLinked: true,
      adminId: "admin1",
      employeeId: null,
    },
  });
  authMock.signInAs("admin-uid");
};

const signInAsEmployee = () => {
  authMock.addAccount({ uid: "emp-uid", email: "eli@kora.test", displayName: "Eli Employee" });
  firestoreMock.seed({
    "users/emp-uid": {
      fullName: "Eli Employee",
      email: "eli@kora.test",
      role: UserRole.Employee,
      isLinked: true,
      adminId: null,
      employeeId: "emp1",
    },
  });
  authMock.signInAs("emp-uid");
};

const signInUnlinked = () => {
  authMock.addAccount({ uid: "new-uid", email: "nadia@kora.test", displayName: "Nadia New" });
  firestoreMock.seed({
    "users/new-uid": {
      fullName: "Nadia New",
      email: "nadia@kora.test",
      role: UserRole.Unassigned,
      requestedRole: UserRole.Employee,
      isLinked: false,
      adminId: null,
      employeeId: null,
    },
  });
  authMock.signInAs("new-uid");
};

beforeEach(() => {
  firestoreMock.reset();
  authMock.reset();
  vi.resetModules();
});

describe("a signed-out visitor", () => {
  it("is sent to the login screen from a protected URL", async () => {
    const { currentPath } = renderWithProviders(routes, { route: "/admin/dashboard" });

    await waitFor(() => expect(currentPath()).toBe("/"));
    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });

  it("never flashes the protected screen while the session is still resolving", async () => {
    renderWithProviders(routes, { route: "/admin/dashboard" });

    // Firebase restores the session asynchronously, so the guard renders a
    // spinner first. Rendering children during that window would show one
    // employee another's salary for a frame.
    expect(screen.queryByRole("heading", { name: "Admin dashboard" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument());
  });
});

describe("a signed-in but unlinked user", () => {
  it("is sent to the not-linked hash rather than to a screen", async () => {
    signInUnlinked();
    const { currentPath } = renderWithProviders(routes, { route: "/employee/home" });

    // The login screen keys its "waiting to be linked" notice off this hash.
    await waitFor(() => expect(currentPath()).toBe("/#notlinked"));
  });

  it("is turned away from an any-role route too", async () => {
    signInUnlinked();
    const { currentPath } = renderWithProviders(routes, { route: "/employee/profile" });

    // `requires="any"` means any *linked* role, not "anyone signed in".
    await waitFor(() => expect(currentPath()).toBe("/#notlinked"));
    expect(screen.queryByRole("heading", { name: "Profile" })).not.toBeInTheDocument();
  });
});

describe("an admin", () => {
  it("reaches the admin dashboard", async () => {
    signInAsAdmin();
    renderWithProviders(routes, { route: "/admin/dashboard" });

    expect(await screen.findByRole("heading", { name: "Admin dashboard" })).toBeInTheDocument();
  });

  it("is bounced off an employee-only screen", async () => {
    signInAsAdmin();
    const { currentPath } = renderWithProviders(routes, { route: "/employee/home" });

    await waitFor(() => expect(currentPath()).toBe("/admin/dashboard"));
    expect(screen.getByRole("heading", { name: "Admin dashboard" })).toBeInTheDocument();
  });

  it("reaches an any-role screen", async () => {
    signInAsAdmin();
    renderWithProviders(routes, { route: "/employee/profile" });

    expect(await screen.findByRole("heading", { name: "Profile" })).toBeInTheDocument();
  });
});

describe("an employee", () => {
  it("reaches the employee home", async () => {
    signInAsEmployee();
    renderWithProviders(routes, { route: "/employee/home" });

    expect(await screen.findByRole("heading", { name: "Employee home" })).toBeInTheDocument();
  });

  it("is bounced off the admin dashboard", async () => {
    signInAsEmployee();
    const { currentPath } = renderWithProviders(routes, { route: "/admin/dashboard" });

    await waitFor(() => expect(currentPath()).toBe("/employee/home"));
    // The redirect is the access control — there is no server to refuse the
    // read, only the Firestore rules, and this is what keeps the screen from
    // being requested at all.
    expect(screen.queryByRole("heading", { name: "Admin dashboard" })).not.toBeInTheDocument();
  });
});

describe("the role claim has to match the link", () => {
  it("does not treat a stale adminId as admin access when the role says employee", async () => {
    authMock.addAccount({ uid: "odd-uid", email: "odd@kora.test" });
    firestoreMock.seed({
      "users/odd-uid": {
        fullName: "Odd One",
        email: "odd@kora.test",
        // The context requires the role *and* the matching record id, so an id
        // left behind by an earlier link grants nothing on its own.
        role: UserRole.Employee,
        isLinked: true,
        adminId: "admin1",
        employeeId: "emp1",
      },
    });
    authMock.signInAs("odd-uid");

    const { currentPath } = renderWithProviders(routes, { route: "/admin/dashboard" });

    await waitFor(() => expect(currentPath()).toBe("/employee/home"));
    expect(screen.getByRole("heading", { name: "Employee home" })).toBeInTheDocument();
  });

  it("treats a signed-in user with no profile document as unlinked", async () => {
    // A Google sign-in whose profile write failed: the auth account exists, the
    // users/{uid} doc does not.
    authMock.addAccount({ uid: "ghost-uid", email: "ghost@kora.test" });
    authMock.signInAs("ghost-uid");

    const { currentPath } = renderWithProviders(routes, { route: "/employee/home" });

    await waitFor(() => expect(currentPath()).toBe("/#notlinked"));
  });

});

/**
 * A "limbo" account is linked but holds no usable role — `role` and the matching
 * record id disagree, so the context sets neither `isAdmin` nor `isEmployee`.
 *
 * This used to hang the browser. The admin guard's fallback is the employee home
 * and the employee guard's fallback is the admin dashboard, so a user who
 * satisfies neither was redirected between the two until the tab locked up.
 * Every test below mounts the **full** route table on purpose: if the guard ever
 * stops catching this state before those two redirects, these hang rather than
 * fail politely — which is the loop reappearing.
 */
describe("a linked user with no usable role", () => {
  const signInInLimbo = (overrides: Record<string, unknown> = {}) => {
    authMock.addAccount({ uid: "limbo-uid", email: "limbo@kora.test" });
    firestoreMock.seed({
      "users/limbo-uid": {
        fullName: "Lee Limbo",
        email: "limbo@kora.test",
        role: UserRole.Unassigned,
        isLinked: true,
        adminId: null,
        employeeId: null,
        ...overrides,
      },
    });
    authMock.signInAs("limbo-uid");
  };

  it("is sent to the not-linked screen instead of between the two guards", async () => {
    signInInLimbo();
    const { currentPath } = renderWithProviders(routes, { route: "/admin/dashboard" });

    // Only an admin can repair the record, so this is the same destination an
    // unlinked account gets — and, unlike either home route, it terminates.
    await waitFor(() => expect(currentPath()).toBe("/#notlinked"));
    expect(screen.queryByRole("heading", { name: "Admin dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Employee home" })).not.toBeInTheDocument();
  });

  it("lands in the same place coming from the employee route", async () => {
    signInInLimbo();
    const { currentPath } = renderWithProviders(routes, { route: "/employee/home" });

    await waitFor(() => expect(currentPath()).toBe("/#notlinked"));
  });

  it("is turned away from an any-role route too", async () => {
    signInInLimbo();
    const { currentPath } = renderWithProviders(routes, { route: "/employee/profile" });

    // `requires="any"` means any usable role. A profile screen has nothing to
    // render for someone with neither an employee nor an admin record.
    await waitFor(() => expect(currentPath()).toBe("/#notlinked"));
    expect(screen.queryByRole("heading", { name: "Profile" })).not.toBeInTheDocument();
  });

  it("treats role: admin with no adminId as limbo, not as an admin", async () => {
    // The half-written link: a role granted without the record it points at.
    signInInLimbo({ role: UserRole.Admin });
    const { currentPath } = renderWithProviders(routes, { route: "/admin/dashboard" });

    await waitFor(() => expect(currentPath()).toBe("/#notlinked"));
  });

  it("treats role: employee with no employeeId as limbo, not as an employee", async () => {
    signInInLimbo({ role: UserRole.Employee });
    const { currentPath } = renderWithProviders(routes, { route: "/employee/home" });

    await waitFor(() => expect(currentPath()).toBe("/#notlinked"));
  });
});

describe("linking an account while its screen is open", () => {
  it("keeps the user out until the context is refreshed", async () => {
    signInUnlinked();
    const { currentPath } = renderWithProviders(routes, { route: "/employee/home" });

    await waitFor(() => expect(currentPath()).toBe("/#notlinked"));

    // An admin links them in another tab.
    firestoreMock.seed({
      "users/new-uid": {
        fullName: "Nadia New",
        email: "nadia@kora.test",
        role: UserRole.Employee,
        isLinked: true,
        adminId: null,
        employeeId: "emp1",
      },
    });

    // The context is not live — it reads the doc once per auth state change —
    // so the open page does not notice. `refresh()` (or a reload) is what picks
    // it up, which is why UnlinkedMessage has a "Refresh" button.
    expect(currentPath()).toBe("/#notlinked");
  });
});
