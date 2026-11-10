import { describe, it, expect, beforeEach, vi } from "vitest";
import { firestoreMock } from "@/test/firestore";
import {
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
  within,
} from "@/test/renderWithProviders";

/**
 * Flow test — the admin's Leave Requests screen, driven the way a person drives it.
 *
 * `leave.flow.test.ts` proves the transaction works when it is called. What it
 * cannot show is whether an admin can reach it: the approve, reject and undo
 * buttons are chosen by comparing a stored status, and the rows are typed `any`,
 * so a comparison against the wrong kind of value compiles, passes every API
 * test, and leaves the screen with no buttons at all.
 *
 * The seeds spell the statuses as literal strings on purpose. They are what is in
 * Firestore, and a test built from the enum would agree with the code by
 * construction.
 */

vi.mock("firebase/firestore", async () => (await import("@/test/firestore")).firestoreModule());
vi.mock("firebase/auth", async () => (await import("@/test/firebaseApp")).firebaseAuthModule());
vi.mock("@/services/firebase", async () => (await import("@/test/firebaseApp")).firebaseAppModule());

import AdminLeaveRequests from "@/features/leave/pages/AdminLeaveRequests";

const REQUEST = "leaveRequests/req1";
const BALANCE = "employees/emp1/leaveBalances/annual";

/** The request runs 7 to 9 December, so it asks for 3 days. */
const seed = ({ status = "pending", remainingDays = 10, hasBalance = true } = {}) =>
  firestoreMock.seed({
    "employees/emp1": { fullName: "Sam Test" },
    ...(hasBalance && {
      [BALANCE]: {
        leaveTypeId: "annual",
        leaveTypeName: "Annual",
        description: "Paid time off for rest and holidays.",
        defaultDays: 15,
        remainingDays,
      },
    }),
    [REQUEST]: {
      employeeId: "emp1",
      employeeName: "Sam Test",
      leaveTypeId: "annual",
      leaveTypeName: "Annual",
      startDate: "2026-12-07",
      endDate: "2026-12-09",
      comment: "",
      status,
      createdAt: "2026-11-10T08:00:00.000Z",
    },
  });

/** The table and the cards are both in the DOM. They share one set of renderers. */
const cards = () => within(screen.getByTestId("responsive-table-cards"));

const renderPage = () => renderWithProviders(<AdminLeaveRequests />, { withAuth: false });

const findUndoButton = async () =>
  (await cards().findByTestId("UndoRoundedIcon")).closest("button") as HTMLButtonElement;

describe("the admin Leave Requests screen", () => {
  beforeEach(() => {
    firestoreMock.reset();
    // EditPolicyModal reads this while rendering, and Vitest's environment does
    // not always provide it.
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => undefined });
  });

  it("offers approve and reject on a pending request", async () => {
    seed();
    renderPage();

    expect(await cards().findByRole("button", { name: "check" })).toBeTruthy();
    expect(cards().getByRole("button", { name: "close" })).toBeTruthy();
  });

  it("shows how many days the employee has left", async () => {
    seed({ remainingDays: 10 });
    renderPage();

    expect(await cards().findByText("10 days")).toBeTruthy();
    expect(cards().queryByText(/undefined/)).toBeNull();
  });

  it("counts a missing balance as no days left", async () => {
    seed({ hasBalance: false });
    renderPage();

    expect(await cards().findByText("0 days")).toBeTruthy();
  });

  it("spends the days when a request is approved", async () => {
    seed({ remainingDays: 10 });
    renderPage();

    await userEvent.click(await cards().findByRole("button", { name: "check" }));

    await waitFor(() => expect(firestoreMock.get(REQUEST)?.status).toBe("approved"));
    expect(firestoreMock.get(BALANCE)?.remainingDays).toBe(7);
  });

  it("leaves the balance alone when a request is rejected", async () => {
    seed({ remainingDays: 10 });
    renderPage();

    await userEvent.click(await cards().findByRole("button", { name: "close" }));

    await waitFor(() => expect(firestoreMock.get(REQUEST)?.status).toBe("rejected"));
    expect(firestoreMock.get(BALANCE)?.remainingDays).toBe(10);
  });

  it("gives the days back when an approval is undone", async () => {
    seed({ status: "approved", remainingDays: 7 });
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Approved" }));
    await userEvent.click(await findUndoButton());

    await waitFor(() => expect(firestoreMock.get(REQUEST)?.status).toBe("pending"));
    expect(firestoreMock.get(BALANCE)?.remainingDays).toBe(10);
  });

  it("offers undo on a rejected request", async () => {
    seed({ status: "rejected" });
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Rejected" }));

    expect(await findUndoButton()).toBeTruthy();
  });

  it("asks before approving more days than the employee has", async () => {
    seed({ remainingDays: 1 });
    renderPage();

    await userEvent.click(await cards().findByRole("button", { name: "check" }));

    expect(await screen.findByText("Over-Balance Request")).toBeTruthy();
    expect(firestoreMock.get(REQUEST)?.status).toBe("pending");

    await userEvent.click(screen.getByRole("button", { name: "Approve Anyway" }));

    await waitFor(() => expect(firestoreMock.get(REQUEST)?.status).toBe("approved"));
    expect(firestoreMock.get(BALANCE)?.remainingDays).toBe(-2);
  });
});
