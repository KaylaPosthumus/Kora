/**
 * The claim watch in `AuthContext`.
 *
 * `syncRoleClaim` writes `userClaims/{uid}.refreshTime` whenever it rewrites a
 * user's custom claims, and the context watches that document so a role change
 * reaches the client in seconds rather than whenever the ID token happens to
 * rotate. These tests pin the two decisions that make it safe to leave running:
 * the first snapshot is recorded rather than acted on, and a failure never takes
 * the session down.
 */

import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("firebase/firestore", async () => (await import("@/test/firestore")).firestoreModule());
vi.mock("@/services/firebase", async () => (await import("@/test/firebaseApp")).firebaseAppModule());
vi.mock("firebase/auth", async () => (await import("@/test/firebaseApp")).firebaseAuthModule());

import { firestoreMock } from "@/test/firestore";
import { authMock } from "@/test/firebaseApp";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

/** Renders the user's resolved role, so a refresh is observable in the DOM. */
const RoleProbe: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) return <span>loading</span>;
  return <span data-testid="role">{user?.role ?? "none"}</span>;
};

const renderProvider = () =>
  render(
    <AuthProvider>
      <RoleProbe />
    </AuthProvider>
  );

/** A signed-in user with a `users/{uid}` document. */
const signIn = (role: string) => {
  authMock.addAccount({ uid: "uid1", email: "sam@kora.test" });
  firestoreMock.seed({
    "users/uid1": {
      fullName: "Sam",
      email: "sam@kora.test",
      role,
      isLinked: role !== "unassigned",
      employeeId: role === "employee" ? "emp1" : null,
    },
  });
  authMock.signInAs("uid1");
};

/**
 * Stamps a new refreshTime, as syncRoleClaim does after changing claims.
 *
 * Seeded as an ISO string rather than a Timestamp: the double clones through
 * JSON, so an object carrying a `toMillis` method could not survive it. The
 * context compares a normalised key precisely so both shapes work.
 */
const stampClaimRefresh = (at: string) =>
  firestoreMock.seed({ "userClaims/uid1": { refreshTime: at } });

describe("the claim watch", () => {
  beforeEach(() => {
    firestoreMock.reset();
    authMock.reset();
  });

  it("subscribes once a user is signed in", async () => {
    signIn("employee");
    renderProvider();

    await screen.findByTestId("role");
    // onAuthStateChanged plus the userClaims document.
    await waitFor(() => expect(firestoreMock.listenerCount()).toBeGreaterThan(0));
  });

  it("does not subscribe while signed out", async () => {
    renderProvider();

    await screen.findByTestId("role");
    expect(firestoreMock.listenerCount()).toBe(0);
  });

  // The document already exists from whenever the claim was last written, so
  // acting on the first read would force a token refresh on every page load.
  it("records the first snapshot without refreshing the token", async () => {
    signIn("employee");
    stampClaimRefresh("2026-09-07T10:00:00.000Z");
    renderProvider();

    await screen.findByTestId("role");

    // If mounting had forced a refresh, this later write would be picked up.
    firestoreMock.seed({ "users/uid1": { role: "admin", isLinked: true, adminId: "adm1" } });

    await waitFor(() => expect(screen.getByTestId("role")).toHaveTextContent("employee"));
  });

  it("re-reads the user document when the stamp moves", async () => {
    signIn("unassigned");
    stampClaimRefresh("2026-09-07T10:00:00.000Z");
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("role")).toHaveTextContent("unassigned"));

    // An admin links the account: the user document changes and syncRoleClaim
    // stamps a new refreshTime.
    firestoreMock.seed({
      "users/uid1": {
        fullName: "Sam",
        email: "sam@kora.test",
        role: "employee",
        isLinked: true,
        employeeId: "emp1",
      },
    });
    stampClaimRefresh("2026-09-07T11:00:00.000Z");

    await waitFor(() => expect(screen.getByTestId("role")).toHaveTextContent("employee"));
  });

  it("ignores a snapshot whose stamp has not moved", async () => {
    signIn("unassigned");
    stampClaimRefresh("2026-09-07T10:00:00.000Z");
    renderProvider();
    await screen.findByTestId("role");

    // A write that leaves refreshTime alone must not trigger a re-read.
    firestoreMock.seed({
      "userClaims/uid1": { refreshTime: "2026-09-07T10:00:00.000Z", other: "changed" },
    });
    firestoreMock.seed({ "users/uid1": { role: "admin", isLinked: true, adminId: "adm1" } });

    // Still the originally rendered role: nothing prompted a refresh.
    await waitFor(() => expect(screen.getByTestId("role")).toHaveTextContent("unassigned"));
  });

  // The rules' get() fallback still authorises correctly, so a watch that
  // cannot run must degrade quietly rather than break the session.
  it("keeps the session alive when the claim document cannot be read", async () => {
    signIn("employee");
    renderProvider();

    await screen.findByTestId("role");
    expect(screen.getByTestId("role")).toHaveTextContent("employee");
  });

  it("stops watching when the user signs out", async () => {
    signIn("employee");
    const { unmount } = renderProvider();
    await screen.findByTestId("role");

    unmount();

    await waitFor(() => expect(firestoreMock.listenerCount()).toBe(0));
  });
});
