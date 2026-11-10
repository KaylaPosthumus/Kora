import { describe, it, expect, beforeEach, vi } from "vitest";
import { firestoreMock } from "@/test/firestore";
import { authMock } from "@/test/firebaseApp";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/renderWithProviders";
import { UserRole } from "@/shared/types/common";

/**
 * Flow test — the leave policy, from the admin who writes it to the employee who
 * reads it.
 *
 * The two ends are different screens on different people's devices, which is the
 * whole point of the test: the wording used to be kept in the browser's own
 * storage, so the editor reported success and no employee ever saw the change.
 */

vi.mock("firebase/firestore", async () => (await import("@/test/firestore")).firestoreModule());
vi.mock("firebase/auth", async () => (await import("@/test/firebaseApp")).firebaseAuthModule());
vi.mock("@/services/firebase", async () => (await import("@/test/firebaseApp")).firebaseAppModule());

const POLICY = "settings/leavePolicy";
const STANDARD_WORDING = /Employees must submit leave requests in advance/;
const SAVED_WORDING = "Book annual leave two weeks ahead.";

const renderEditor = async (setShowModal: (show: boolean) => void = vi.fn()) => {
  const { EditPolicyModal } = await import("@/features/leave/components");
  renderWithProviders(<EditPolicyModal showModal setShowModal={setShowModal} />, {
    withAuth: false,
  });
  return (await screen.findByLabelText("Policy")) as HTMLTextAreaElement;
};

/** `authService` caches the session at module scope, so the page is imported late. */
const renderEmployeeScreen = async () => {
  authMock.addAccount({ uid: "emp-uid", email: "eli@kora.test" });
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

  const { default: EmployeeLeaveOverview } = await import(
    "@/features/leave/pages/EmployeeLeaveOverview"
  );
  renderWithProviders(<EmployeeLeaveOverview />, { withAuth: false });
};

beforeEach(() => {
  firestoreMock.reset();
  authMock.reset();
  vi.resetModules();
});

describe("the admin's policy editor", () => {
  it("opens on the saved wording", async () => {
    firestoreMock.seed({ [POLICY]: { text: SAVED_WORDING } });

    const box = await renderEditor();

    await waitFor(() => expect(box.value).toBe(SAVED_WORDING));
  });

  it("opens on the standard wording when none has been saved", async () => {
    const box = await renderEditor();

    await waitFor(() => expect(box.value).toMatch(STANDARD_WORDING));
  });

  it("saves the wording where employees can read it", async () => {
    const setShowModal = vi.fn();
    const box = await renderEditor(setShowModal);
    await waitFor(() => expect(box.value).toMatch(STANDARD_WORDING));
    const user = userEvent.setup();

    await user.clear(box);
    await user.type(box, SAVED_WORDING);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(firestoreMock.get(POLICY)?.text).toBe(SAVED_WORDING));
    await waitFor(() => expect(setShowModal).toHaveBeenCalledWith(false));
  });

  it("stays open and says so when the save fails", async () => {
    const setShowModal = vi.fn();
    const box = await renderEditor(setShowModal);
    await waitFor(() => expect(box.value).toMatch(STANDARD_WORDING));
    const { leavePolicyAPI } = await import("@/features/leave/api/leaveApi");
    vi.spyOn(leavePolicyAPI, "save").mockRejectedValue(new Error("permission-denied"));

    await userEvent.setup().click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("The policy was not saved. Please try again.")).toBeInTheDocument();
    expect(setShowModal).not.toHaveBeenCalled();
  });
});

describe("the employee's leave screen", () => {
  it("shows the wording the admin saved", async () => {
    firestoreMock.seed({ [POLICY]: { text: SAVED_WORDING } });

    await renderEmployeeScreen();

    expect(await screen.findByText(SAVED_WORDING)).toBeInTheDocument();
  });

  it("shows the standard wording when none has been saved", async () => {
    await renderEmployeeScreen();

    expect(await screen.findByText(STANDARD_WORDING)).toBeInTheDocument();
  });

  it("falls back to the standard wording when the policy cannot be read", async () => {
    firestoreMock.seed({ [POLICY]: { text: SAVED_WORDING } });
    const { leavePolicyAPI } = await import("@/features/leave/api/leaveApi");
    vi.spyOn(leavePolicyAPI, "get").mockRejectedValue(new Error("unavailable"));

    await renderEmployeeScreen();

    expect(await screen.findByText(STANDARD_WORDING)).toBeInTheDocument();
    expect(screen.queryByText(SAVED_WORDING)).not.toBeInTheDocument();
  });
});
