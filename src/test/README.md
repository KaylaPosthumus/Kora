# Testing

Two tiers, told apart by filename.

| | Unit | Flow |
|---|---|---|
| Filename | `*.test.ts(x)` | `*.flow.test.ts(x)` |
| Lives in | `__tests__/` next to the code | `src/__tests__/flows/` |
| Covers | one function, one decision | one journey across several modules |
| Run with | `npm run test:unit` | `npm run test:flows` |

`npm test` runs both. `npm run test:watch` watches.

```bash
npx vitest run src/utils/__tests__/dateUtils.test.ts   # one file
npx vitest run -t "decrements the balance exactly once" # one case
```

Vitest is configured inside `vite.config.ts`, not a separate file. The suite runs
with `TZ=UTC` — dayjs formats in the local zone, so without that a date assertion
would pass in Johannesburg and fail on CI.

## Which tier does a test belong in?

Write a **unit test** when the thing you are checking is a decision one function
makes: a status transition, a formatting rule, which fields get mirrored.

Write a **flow test** when the bug you are guarding against lives in the *seam*
between two modules — the document one function writes being the document
another reads, a service result reaching a screen and changing what it renders.
`onboarding.flow.test.ts` is the clearest example: every function it calls is
already unit-tested, and the test still earns its place because nothing else
checks that signup, linking and login agree with each other.

If a flow test is only reachable by mocking out the middle of the flow, it wants
to be a unit test instead.

## The doubles

There is no emulator (see the README at the repo root), so everything below the
service layer is replaced at the module boundary. Nothing here touches the live
project.

### `firestore.ts` — an in-memory Firestore

Documents are a flat map from path to data, so subcollections work for free and
`firestoreMock.get("employees/emp1/leaveBalances/annual")` reads exactly what the
code wrote. Supports the operators `api.service.ts` uses (`==`, `in`, `orderBy`,
`limit`, `documentId()`), batches, transactions and `onSnapshot`; anything else
throws rather than quietly returning every document.

`vi.mock` is hoisted above imports, so the factory has to import the double
rather than close over it:

```ts
vi.mock("firebase/firestore", async () => (await import("../../test/firestore")).firestoreModule());
vi.mock("../firebase", async () => (await import("../../test/firebaseApp")).firebaseAppModule());

import { firestoreMock } from "../../test/firestore";

beforeEach(() => firestoreMock.reset());

firestoreMock.seed({ "users/uid1": { role: "employee", isLinked: true } });
firestoreMock.get("users/uid1");            // current data
firestoreMock.pathsIn("employees");         // what is in a collection
firestoreMock.writes();                     // every write, in order
firestoreMock.listenerCount();              // 0 after a clean unmount
```

Two things differ from the real SDK on purpose. Auto-generated ids are sequential
(`auto-1`, `auto-2`) so a test can assert on the id of something it just created,
and `onSnapshot` emits **synchronously** — on subscribe and after any write that
changes the query's results — so a flow test can assert straight after the write.

### `firebaseApp.ts` — Firebase Auth and the app module

`src/services/firebase.ts` calls `initializeApp` at import time, so any test that
reaches a service has to replace it. `firebaseAuthModule()` keeps a real account
list rather than a stubbed return value, which is what lets a flow test sign up
through `employeeSignUp` and then sign in with the same credentials.

```ts
authMock.addAccount({ uid: "emp-uid", email: "eli@kora.test", password: "pw" });
authMock.signInAs("emp-uid");        // fires onAuthStateChanged
authMock.nextPopupUser({ ... });     // what signInWithPopup returns
authMock.nextPopupError("auth/popup-closed-by-user");
```

Failures come back as `{ code: "auth/…" }` because that is the shape
`authService.ts` maps onto its numeric result codes.

### `navigation.ts` — capturing redirects

`authService` predates the router and navigates by assigning
`window.location.href`, which jsdom refuses to honour. `captureNavigation()`
swaps in a recording location so `navigation.last()` can be asserted. Call it
once at module scope and `reset()` in `beforeEach`.

### `renderWithProviders.tsx` — rendering a screen

Wraps the UI in a `MemoryRouter` and the **real** `AuthProvider`, and returns
`currentPath()` alongside the usual Testing Library result. Re-exports everything
from `@testing-library/react` plus `userEvent`, so a flow test needs one import.

```tsx
const { currentPath } = renderWithProviders(routes, { route: "/admin/dashboard" });
await waitFor(() => expect(currentPath()).toBe("/employee/home"));
```

The provider is the real one deliberately: a test that stubbed the auth context
would not exercise the guard logic deciding where a user lands, which is the part
worth testing. Pass `withAuth: false` for a component that does not read it.

## Gotchas

- **`authService` caches at module scope** — the session promise and the
  `users/{uid}` doc. Call `vi.resetModules()` in `beforeEach` and import the
  module (and any component that imports it) *inside* the test, or one test's
  signed-in user leaks into the next.
- **Testing Library cleanup is manual here.** It is registered in `setup.ts`
  because the suite does not run with Vitest globals.
- **A guard regression hangs the run rather than failing it.** `ProtectedRoute`
  sends a linked user with no usable role to `/#notlinked`; before that branch
  existed they were redirected admin → employee → admin forever, because each
  guard's fallback is the other's route. The "a linked user with no usable role"
  tests in `routeGuard.flow.test.tsx` mount the full route table to cover it, so
  if that branch is removed those tests lock up instead of reporting a failure.
  A flow test that suddenly never finishes is the symptom to look for.
