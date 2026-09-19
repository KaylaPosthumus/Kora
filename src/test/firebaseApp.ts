/**
 * Stand-ins for `src/services/firebase.ts` and `firebase/auth`.
 *
 * `src/services/firebase.ts` calls `initializeApp` at import time, so any test
 * that reaches a service has to replace it — otherwise the SDK tries to reach a
 * real project with undefined config. It is mocked for its side effect as much
 * as for its exports.
 *
 * The `firebase/auth` double keeps a small account list rather than resolving
 * whatever the test last stubbed, so a flow test can sign up through
 * `employeeSignUp` and then sign in with the same credentials and have it work.
 * Failures come back as `{ code: "auth/…" }` objects because that is the shape
 * `authService.ts` maps to its numeric result codes.
 *
 * ```ts
 * vi.mock("../../services/firebase", async () => (await import("@/firebaseApp")).firebaseAppModule());
 * vi.mock("firebase/auth", async () => (await import("@/firebaseApp")).firebaseAuthModule());
 *
 * import { authMock } from "@/firebaseApp";
 * beforeEach(() => authMock.reset());
 * ```
 *
 * Like the Firestore double, state lives on `globalThis` so `vi.resetModules()`
 * does not quietly hand a test a second, empty copy.
 */

export interface FakeUser {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

interface Account extends FakeUser {
  password: string;
}

interface AuthState {
  accounts: Map<string, Account>;
  currentUser: FakeUser | null;
  observers: Array<(user: FakeUser | null) => void>;
  verificationsSent: string[];
  uidCounter: number;
  /** Set to make the next popup sign-in fail with this Firebase error code. */
  popupError: string | null;
  /** The account the next popup sign-in returns. */
  popupAccount: Account | null;
}

const GLOBAL_KEY = "__koraAuthMock__";

const state = (): AuthState => {
  const host = globalThis as Record<string, any>;
  if (!host[GLOBAL_KEY]) {
    host[GLOBAL_KEY] = {
      accounts: new Map<string, Account>(),
      currentUser: null,
      observers: [],
      verificationsSent: [],
      uidCounter: 0,
      popupError: null,
      popupAccount: null,
    } satisfies AuthState;
  }
  return host[GLOBAL_KEY] as AuthState;
};

const authError = (code: string) => Object.assign(new Error(code), { code });

const publicUser = (account: Account): FakeUser => ({
  uid: account.uid,
  email: account.email,
  displayName: account.displayName,
  photoURL: account.photoURL,
  emailVerified: account.emailVerified,
});

const setCurrentUser = (user: FakeUser | null) => {
  const auth = state();
  auth.currentUser = user;
  // Firebase notifies observers asynchronously; doing it inline would run the
  // callback before the caller has stored the unsubscribe it returns.
  auth.observers.forEach((observe) => queueMicrotask(() => observe(user)));
};

/** The object `src/services/firebase.ts` exports, with inert doubles. */
export const firebaseAppModule = () => ({
  auth: new Proxy({} as Record<string, unknown>, {
    // authService reads `auth.currentUser` directly, and it has to reflect the
    // most recent sign-in rather than whatever it was at mock-creation time.
    get: (_target, property) =>
      property === "currentUser" ? state().currentUser : undefined,
  }),
  db: { __fake: "db" },
  storage: { __fake: "storage" },
  googleProvider: { __fake: "googleProvider" },
  default: { __fake: "app" },
});

/** The subset of `firebase/auth` the app imports. */
export const firebaseAuthModule = () => ({
  getAuth: () => firebaseAppModule().auth,

  GoogleAuthProvider: class {
    setCustomParameters(): void {
      return undefined;
    }
  },

  onAuthStateChanged: (
    _auth: unknown,
    observer: (user: FakeUser | null) => void
  ): (() => void) => {
    const auth = state();
    auth.observers.push(observer);
    queueMicrotask(() => observer(auth.currentUser));
    return () => {
      auth.observers = auth.observers.filter((candidate) => candidate !== observer);
    };
  },

  createUserWithEmailAndPassword: async (
    _auth: unknown,
    email: string,
    password: string
  ) => {
    const auth = state();
    if ([...auth.accounts.values()].some((account) => account.email === email)) {
      throw authError("auth/email-already-in-use");
    }
    if (password.length < 6) throw authError("auth/weak-password");

    const account: Account = {
      uid: `uid-${(auth.uidCounter += 1)}`,
      email,
      password,
      displayName: null,
      photoURL: null,
      emailVerified: false,
    };
    auth.accounts.set(account.uid, account);
    setCurrentUser(publicUser(account));
    return { user: publicUser(account) };
  },

  signInWithEmailAndPassword: async (_auth: unknown, email: string, password: string) => {
    const account = [...state().accounts.values()].find(
      (candidate) => candidate.email === email
    );
    // Firebase returns the same code for a wrong password and an unknown email,
    // and authService maps both to 401.
    if (!account || account.password !== password) {
      throw authError("auth/invalid-credential");
    }
    setCurrentUser(publicUser(account));
    return { user: publicUser(account) };
  },

  signInWithPopup: async () => {
    const auth = state();
    if (auth.popupError) throw authError(auth.popupError);
    if (!auth.popupAccount) {
      throw new Error("auth mock: call authMock.nextPopupUser(...) before signInWithPopup");
    }
    setCurrentUser(publicUser(auth.popupAccount));
    return { user: publicUser(auth.popupAccount) };
  },

  signOut: async () => setCurrentUser(null),

  sendEmailVerification: async (user: FakeUser) => {
    state().verificationsSent.push(user.uid);
  },

  updateProfile: async (user: FakeUser, profile: { displayName?: string; photoURL?: string }) => {
    const account = state().accounts.get(user.uid);
    if (!account) return;
    if (profile.displayName !== undefined) account.displayName = profile.displayName;
    if (profile.photoURL !== undefined) account.photoURL = profile.photoURL;
    if (state().currentUser?.uid === user.uid) setCurrentUser(publicUser(account));
  },
});

/** What `addAccount` and `nextPopupUser` take. */
export interface AccountSeed {
  uid: string;
  email: string;
  password?: string;
  displayName?: string | null;
  photoURL?: string | null;
  emailVerified?: boolean;
}

/** Test-facing controls over the fake auth backend. */
export const authMock = {
  reset(): void {
    const auth = state();
    auth.accounts.clear();
    auth.currentUser = null;
    auth.observers = [];
    auth.verificationsSent = [];
    auth.uidCounter = 0;
    auth.popupError = null;
    auth.popupAccount = null;
  },

  /** Registers an account without going through the signup flow. */
  addAccount(account: AccountSeed): FakeUser {
    const record: Account = {
      uid: account.uid,
      email: account.email,
      password: account.password ?? "password",
      displayName: account.displayName ?? null,
      photoURL: account.photoURL ?? null,
      emailVerified: account.emailVerified ?? true,
    };
    state().accounts.set(record.uid, record);
    return publicUser(record);
  },

  /** Signs a known uid in (or out, with null) and notifies `onAuthStateChanged`. */
  signInAs(uid: string | null): void {
    if (uid === null) return setCurrentUser(null);
    const account = state().accounts.get(uid);
    if (!account) throw new Error(`auth mock: no account with uid "${uid}"`);
    setCurrentUser(publicUser(account));
  },

  /** The account the next `signInWithPopup` resolves with. */
  nextPopupUser(account: AccountSeed): FakeUser {
    const user = this.addAccount(account);
    state().popupAccount = state().accounts.get(user.uid) ?? null;
    state().popupError = null;
    return user;
  },

  /** Makes the next `signInWithPopup` reject, e.g. "auth/popup-closed-by-user". */
  nextPopupError(code: string): void {
    state().popupError = code;
  },

  currentUser(): FakeUser | null {
    return state().currentUser;
  },

  /** Uids that were sent a verification email. */
  verificationsSent(): string[] {
    return [...state().verificationsSent];
  },
};
