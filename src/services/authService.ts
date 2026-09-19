import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendEmailVerification,
  signOut,
  updateProfile,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";
import { UserRole } from "@/shared/types/common";

/**
 * Auth service, rebuilt on Firebase Auth.
 *
 * The result contract (`errorCode` / `message`) is kept from the old .NET service
 * so the auth screens keep working: 200 = fine, 300 = signed in but not linked to
 * an employee/admin record yet, 4xx/5xx = failure.
 */
export interface AuthResult {
  errorCode: number;
  message: string;
}

export interface CurrentUserDTO {
  userId: string;
  fullName: string;
  email: string;
  role: UserRole;
  isLinked: boolean;
  employeeId?: string;
  adminId?: string;
  profilePicture?: string;
  isVerified: boolean;
}

/** Shape of a `users/{uid}` document. */
interface UserDoc {
  fullName: string;
  email: string;
  role: UserRole;
  /** What the signup form asked for. Advisory only — never grants anything. */
  requestedRole?: UserRole;
  isLinked: boolean;
  employeeId?: string | null;
  adminId?: string | null;
  profilePicture?: string | null;
}

// Session bootstrap ------------------------------------------------------------------------------

/**
 * Firebase restores the session asynchronously, so `auth.currentUser` is null for
 * the first few hundred ms after a page load. Every guard in the app has to wait
 * for this or a refresh would bounce a signed-in user back to the login screen.
 */
let authReady: Promise<User | null> | null = null;

export const waitForAuthInit = (): Promise<User | null> => {
  if (!authReady) {
    authReady = new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        resolve(user);
      });
    });
  }
  return authReady;
};

// The users/{uid} doc is read on nearly every page mount; cache it per uid.
let cachedUser: CurrentUserDTO | null = null;
let cachedUid: string | null = null;

/** Drop the cached user doc — call after anything that mutates it. */
export const invalidateCurrentUser = (): void => {
  cachedUser = null;
  cachedUid = null;
};

const readUserDoc = async (user: User): Promise<CurrentUserDTO | null> => {
  const snapshot = await getDoc(doc(db, "users", user.uid));

  if (!snapshot.exists()) {
    // Signed in with Firebase but no profile doc yet (e.g. a Google sign-in that
    // never completed). Treat as unlinked rather than erroring.
    return {
      userId: user.uid,
      fullName: user.displayName || "",
      email: user.email || "",
      role: UserRole.Unassigned,
      isLinked: false,
      profilePicture: user.photoURL || undefined,
      isVerified: user.emailVerified,
    };
  }

  const data = snapshot.data() as UserDoc;

  return {
    userId: user.uid,
    fullName: data.fullName,
    email: data.email,
    role: data.role,
    isLinked: data.isLinked,
    employeeId: data.employeeId ?? undefined,
    adminId: data.adminId ?? undefined,
    profilePicture: data.profilePicture || undefined,
    isVerified: user.emailVerified,
  };
};

/** Creates the `users/{uid}` doc for a brand new account. */
const createUserDoc = async (
  user: User,
  input: { fullName: string; requestedRole: UserRole; profilePicture?: string | null }
): Promise<void> => {
  await setDoc(
    doc(db, "users", user.uid),
    {
      fullName: input.fullName,
      email: user.email,
      // Always unassigned. A signup must never grant its own role — whichever
      // form they used, the role is granted by an admin at link time (see
      // employeeAPI.setupUserAsEmployee / linkUserAsAdmin). Which form they used
      // is kept as `requestedRole` so the admin can see what they asked for.
      role: UserRole.Unassigned,
      requestedRole: input.requestedRole,
      // A new signup is never linked — an admin links them to an employee record.
      // These are written as explicit nulls rather than left absent: the create
      // rule tests them, and a missing key errors out rule evaluation (= denied).
      isLinked: false,
      employeeId: null,
      adminId: null,
      profilePicture: input.profilePicture ?? null,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
  invalidateCurrentUser();
};

// Sign up ----------------------------------------------------------------------------------------

/**
 * Creates an account and sends Firebase's verification email.
 *
 * NOTE — behaviour change from the old app: verification is a link Firebase mails
 * out, not a 6-digit code typed back into the app. The account exists (and is
 * usable) before the link is clicked; the old flow withheld the account until the
 * code was entered.
 */
const signUpWithRole = async (
  form: {
    fullName: string;
    email: string;
    password: string;
    profilePicture?: string | null;
  },
  requestedRole: UserRole
): Promise<AuthResult> => {
  try {
    const credential = await createUserWithEmailAndPassword(auth, form.email, form.password);

    await updateProfile(credential.user, { displayName: form.fullName });
    await createUserDoc(credential.user, {
      fullName: form.fullName,
      requestedRole,
      profilePicture: form.profilePicture,
    });
    await sendEmailVerification(credential.user);

    return {
      errorCode: 200,
      message: "Account created. Check your inbox for the verification link.",
    };
  } catch (error) {
    return toAuthResult(error, "Sign up failed");
  }
};

export const employeeSignUp = (form: {
  fullName: string;
  email: string;
  password: string;
  profilePicture?: string | null;
}): Promise<AuthResult> => signUpWithRole(form, UserRole.Employee);

export const adminSignUp = (form: {
  fullName: string;
  email: string;
  password: string;
  profilePicture?: string | null;
}): Promise<AuthResult> => signUpWithRole(form, UserRole.Admin);

/** Re-sends the verification email to the signed-in user. */
export const resendVerificationEmail = async (): Promise<AuthResult> => {
  const user = auth.currentUser;
  if (!user) {
    return { errorCode: 401, message: "You need to be signed in to resend the email." };
  }

  try {
    await sendEmailVerification(user);
    return { errorCode: 200, message: "Verification email sent." };
  } catch (error) {
    return toAuthResult(error, "Could not send the verification email");
  }
};

/** Google sign-up: same popup as sign-in, but seeds the user doc with a role. */
const googleSignUpWithRole = async (requestedRole: UserRole): Promise<AuthResult> => {
  try {
    const credential = await signInWithPopup(auth, googleProvider);
    const existing = await getDoc(doc(db, "users", credential.user.uid));

    if (!existing.exists()) {
      await createUserDoc(credential.user, {
        fullName: credential.user.displayName || "",
        requestedRole,
        profilePicture: credential.user.photoURL,
      });
    }

    return redirectForUser(await getCurrentUser());
  } catch (error) {
    return toAuthResult(error, "Google sign up failed");
  }
};

export const employeeGoogleSignUp = (): Promise<AuthResult> =>
  googleSignUpWithRole(UserRole.Employee);

export const adminGoogleSignUp = (): Promise<AuthResult> => googleSignUpWithRole(UserRole.Admin);

// Log in -----------------------------------------------------------------------------------------

export const loginWithEmail = async (email: string, password: string): Promise<AuthResult> => {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    invalidateCurrentUser();
    return { errorCode: 200, message: "Login successful" };
  } catch (error) {
    return toAuthResult(error, "Incorrect email or password");
  }
};

/** Login + redirect, matching the old `fullEmailLogin` contract. */
export const fullEmailLogin = async (email: string, password: string): Promise<AuthResult> => {
  const result = await loginWithEmail(email, password);
  if (result.errorCode !== 200) return result;

  return redirectForUser(await getCurrentUser());
};

/**
 * Google sign-in. The old signature took an `idToken` produced by the Electron
 * OAuth window; the popup flow needs no token, so it takes no arguments.
 */
export const fullGoogleSignIn = async (): Promise<AuthResult> => {
  try {
    const credential = await signInWithPopup(auth, googleProvider);
    invalidateCurrentUser();

    const existing = await getDoc(doc(db, "users", credential.user.uid));
    if (!existing.exists()) {
      // First Google sign-in for this address — create an unassigned profile so an
      // admin can link them.
      await createUserDoc(credential.user, {
        fullName: credential.user.displayName || "",
        requestedRole: UserRole.Unassigned,
        profilePicture: credential.user.photoURL,
      });
    }

    return redirectForUser(await getCurrentUser());
  } catch (error) {
    return toAuthResult(error, "Google login failed");
  }
};

// Session ----------------------------------------------------------------------------------------

export const getCurrentUser = async (): Promise<CurrentUserDTO | null> => {
  const user = auth.currentUser ?? (await waitForAuthInit());
  if (!user) return null;

  if (cachedUser && cachedUid === user.uid) return cachedUser;

  const currentUser = await readUserDoc(user);
  cachedUser = currentUser;
  cachedUid = user.uid;
  return currentUser;
};

/**
 * Current user, or a redirect away from the page. Used by pages that require a
 * linked account — they call it on mount and read `employeeId` / `adminId`.
 */
export const getFullCurrentUser = async (): Promise<CurrentUserDTO | null> => {
  const user = await getCurrentUser();

  if (!user) {
    window.location.href = "/";
    return null;
  }

  if (!user.isLinked) {
    window.location.href = "/#notlinked";
    return null;
  }

  return user;
};

export const checkIfUserIsLinked = async (): Promise<AuthResult> => {
  // The admin may have linked the account since the doc was last read.
  invalidateCurrentUser();
  const user = await getCurrentUser();

  if (!user || !user.isLinked) {
    window.location.href = "/#notlinked";
    return { errorCode: 400, message: "Your account hasn't been linked yet" };
  }

  const result = redirectForUser(user);
  return result.errorCode === 200
    ? { errorCode: 200, message: "Welcome " + user.fullName }
    : result;
};

/** On the login screen: send an already-signed-in user where they belong. */
export const handleExistingLoginRedirect = async (): Promise<void> => {
  const user = await getCurrentUser();
  if (!user) return;

  redirectForUser(user);
};

export const logout = async (redirect = true): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout failed:", error);
  }

  invalidateCurrentUser();

  if (redirect) {
    window.location.href = "/";
  }
};

/** Navbar helper: -1 not logged in, 0 logged in but unlinked, 1 employee, 2 admin. */
export const navbarUserStatus = async (): Promise<number> => {
  const user = await getCurrentUser();

  if (!user) return -1;
  if (!user.isLinked) return 0;
  if (user.employeeId) return 1;
  if (user.adminId) return 2;

  return -1;
};

// Helpers ----------------------------------------------------------------------------------------

/** Sends a signed-in user to their landing page and reports what happened. */
function redirectForUser(user: CurrentUserDTO | null): AuthResult {
  if (!user) {
    return { errorCode: 404, message: "Could not fetch user details." };
  }

  if (!user.isLinked) {
    window.location.href = "/#notlinked";
    return { errorCode: 300, message: "User account not linked." };
  }

  if (user.adminId) {
    window.location.href = "/admin/dashboard";
    return { errorCode: 200, message: "Login successful." };
  }

  if (user.employeeId) {
    window.location.href = "/employee/home";
    return { errorCode: 200, message: "Login successful." };
  }

  return { errorCode: 403, message: "Unrecognized user role." };
}

/** Maps a Firebase Auth error onto the old numeric-code result shape. */
function toAuthResult(error: unknown, fallbackMessage: string): AuthResult {
  const code = (error as { code?: string })?.code ?? "";

  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return { errorCode: 401, message: "Incorrect email or password" };
    case "auth/email-already-in-use":
      return { errorCode: 409, message: "That email address is already registered" };
    case "auth/weak-password":
      return { errorCode: 400, message: "Password must be at least 6 characters" };
    case "auth/invalid-email":
      return { errorCode: 400, message: "That email address isn't valid" };
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return { errorCode: 499, message: "Sign in was cancelled" };
    case "auth/too-many-requests":
      return { errorCode: 429, message: "Too many attempts — try again shortly" };
    default:
      console.error(fallbackMessage, error);
      return { errorCode: 500, message: fallbackMessage };
  }
}
