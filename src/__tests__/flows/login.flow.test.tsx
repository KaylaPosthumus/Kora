import { describe, it, expect, beforeEach, vi } from "vitest";
import { firestoreMock } from "@/test/firestore";
import { authMock } from "@/test/firebaseApp";
import { captureNavigation } from "@/test/navigation";
import {
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
} from "@/test/renderWithProviders";
import { UserRole } from "@/shared/types/common";

/**
 * Flow test — the login screen, driven the way a person drives it.
 *
 * `authService` is already unit-tested against its numeric result codes. What
 * that cannot show is whether the screen does the right thing with them: a 300
 * has to swap the form for the "waiting to be linked" panel, a 401 has to
 * surface a message that is not a raw `auth/...` string, and a 200 has to
 * actually navigate. Those are three different branches of one handler and they
 * are only reachable by rendering the page.
 *
 * The page navigates by assigning `window.location.href` (it predates the
 * router), so `captureNavigation` stands in for the browser.
 */

vi.mock("firebase/firestore", async () => (await import("@/test/firestore")).firestoreModule());
vi.mock("firebase/auth", async () => (await import("@/test/firebaseApp")).firebaseAuthModule());
vi.mock("@/services/firebase", async () => (await import("@/test/firebaseApp")).firebaseAppModule());

const navigation = captureNavigation();

/**
 * `authService` memoises the session promise and the user doc at module scope,
 * so each test needs a fresh copy — and `Login` has to be imported *after* the
 * reset or it would close over the previous one.
 */
const loadLogin = async () => (await import("@/features/auth/pages/Login")).default;

const seedLinkedEmployee = () => {
  authMock.addAccount({
    uid: "emp-uid",
    email: "eli@kora.test",
    password: "Password123!",
    displayName: "Eli Employee",
  });
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
};

const seedUnlinkedUser = () => {
  authMock.addAccount({
    uid: "new-uid",
    email: "nadia@kora.test",
    password: "Password123!",
    displayName: "Nadia New",
  });
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
};

/** Renders the page and waits for its on-mount session check to finish. */
const renderLogin = async (route = "/") => {
  const Login = await loadLogin();
  const result = renderWithProviders(<Login />, { route, withAuth: false });
  await screen.findByLabelText("Email");
  return result;
};

const logIn = async (email: string, password: string) => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Log In" }));
};

beforeEach(() => {
  firestoreMock.reset();
  authMock.reset();
  navigation.reset();
  vi.resetModules();
});

describe("logging in with email and password", () => {
  it("sends a linked employee to their home screen", async () => {
    seedLinkedEmployee();
    await renderLogin();

    await logIn("eli@kora.test", "Password123!");

    await waitFor(() => expect(navigation.last()).toBe("/employee/home"));
    expect(await screen.findByText(/Login successful/)).toBeInTheDocument();
  });

  it("sends a linked admin to the admin dashboard", async () => {
    authMock.addAccount({ uid: "admin-uid", email: "ada@kora.test", password: "Password123!" });
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
    await renderLogin();

    await logIn("ada@kora.test", "Password123!");

    await waitFor(() => expect(navigation.last()).toBe("/admin/dashboard"));
  });

  it("lowercases and trims the email before submitting it", async () => {
    seedLinkedEmployee();
    await renderLogin();

    // The account is stored lowercase; the field normalises on change, so a
    // pasted "  Eli@Kora.test " still matches.
    await logIn("  Eli@Kora.TEST ", "Password123!");

    await waitFor(() => expect(navigation.last()).toBe("/employee/home"));
  });

  it("shows a readable message for a wrong password and stays put", async () => {
    seedLinkedEmployee();
    await renderLogin();

    await logIn("eli@kora.test", "wrong-password");

    const error = await screen.findByText(/Login failed/);
    expect(error).toBeInTheDocument();
    // Never the raw Firebase code — "auth/invalid-credential" means nothing to
    // the person typing.
    expect(error.textContent).toContain("Incorrect email or password");
    expect(error.textContent).not.toContain("auth/");
    expect(navigation.visited).toHaveLength(0);
  });

  it("shows the same message for an unknown email, without confirming it exists", async () => {
    await renderLogin();

    await logIn("nobody@kora.test", "Password123!");

    expect((await screen.findByText(/Login failed/)).textContent).toContain(
      "Incorrect email or password"
    );
  });

  it("will not submit an empty form", async () => {
    await renderLogin();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Log In" }));

    expect(await screen.findByText("Please enter an email")).toBeInTheDocument();
    expect(await screen.findByText("Please enter a password")).toBeInTheDocument();
    expect(navigation.visited).toHaveLength(0);
  });
});

describe("an account that has not been linked yet", () => {
  it("swaps the form for the waiting-to-be-linked panel", async () => {
    seedUnlinkedUser();
    await renderLogin();

    await logIn("nadia@kora.test", "Password123!");

    // The 300 branch: they are signed in, so the form is no longer the useful
    // thing to show them.
    expect(await screen.findByText(/Almost/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  });

  it("offers a refresh that picks up the link without a re-login", async () => {
    seedUnlinkedUser();
    await renderLogin();
    await logIn("nadia@kora.test", "Password123!");
    await screen.findByText(/Almost/);

    // An admin links them while this panel is open.
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

    navigation.reset();
    await userEvent.setup().click(screen.getByRole("button", { name: "Refresh Page" }));

    // checkIfUserIsLinked drops the cached doc and re-reads it, which is the
    // only reason this works without signing out first.
    await waitFor(() => expect(navigation.last()).toBe("/employee/home"));
  });

  it("shows the panel straight away when the URL carries the notlinked hash", async () => {
    // Where ProtectedRoute sends a signed-in but unlinked user. Rendered
    // directly rather than through `renderLogin`, which waits for a form this
    // branch never shows.
    window.location.hash = "#notlinked";
    const Login = await loadLogin();
    renderWithProviders(<Login />, { route: "/#notlinked", withAuth: false });

    expect(await screen.findByText(/Almost/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  });
});

describe("Google sign-in", () => {
  it("navigates a returning linked user", async () => {
    seedLinkedEmployee();
    authMock.nextPopupUser({ uid: "emp-uid", email: "eli@kora.test" });
    await renderLogin();

    await userEvent.setup().click(screen.getByRole("button", { name: /Log In with Google/ }));

    await waitFor(() => expect(navigation.last()).toBe("/employee/home"));
  });

  it("shows the waiting-to-be-linked panel for a first-time Google user", async () => {
    authMock.nextPopupUser({ uid: "google-uid", email: "gina@kora.test", displayName: "Gina" });
    await renderLogin();

    await userEvent.setup().click(screen.getByRole("button", { name: /Log In with Google/ }));

    expect(await screen.findByText(/Almost/)).toBeInTheDocument();
    // The profile doc is created on the way through, so the admin can see them
    // in the unlinked queue.
    expect(firestoreMock.get("users/google-uid")).toMatchObject({
      role: UserRole.Unassigned,
      isLinked: false,
    });
  });

  it("treats a closed popup as a cancellation, not a failure to report loudly", async () => {
    authMock.nextPopupError("auth/popup-closed-by-user");
    await renderLogin();

    await userEvent.setup().click(screen.getByRole("button", { name: /Log In with Google/ }));

    expect((await screen.findByText(/Login failed/)).textContent).toContain("cancelled");
    expect(navigation.visited).toHaveLength(0);
  });
});

describe("an already signed-in visitor", () => {
  it("is redirected off the login screen on mount", async () => {
    seedLinkedEmployee();
    authMock.signInAs("emp-uid");

    const Login = await loadLogin();
    renderWithProviders(<Login />, { withAuth: false });

    // handleExistingLoginRedirect runs before the form is shown, so a signed-in
    // user never sees a login form they do not need.
    await waitFor(() => expect(navigation.last()).toBe("/employee/home"));
  });
});

describe("the hidden admin signup link", () => {
  it("is not offered by default", async () => {
    await renderLogin();

    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/employee/signup"
    );
    expect(screen.queryByText("For admins?")).not.toBeInTheDocument();
  });

  it("appears after double-clicking the logo", async () => {
    await renderLogin();

    await userEvent.setup().dblClick(screen.getByAltText("Kora"));

    // Deliberately obscure: /admin/signup is a public route, so the app keeps it
    // out of sight rather than out of reach. Worth pinning so nobody "tidies"
    // the handler away and leaves no route to admin signup at all.
    expect(await screen.findByText("For admins?")).toBeInTheDocument();
  });
});
