# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server on :5173
npm run typecheck    # tsc --noEmit
npm run lint         # eslint --ext .ts,.tsx src
npm run build        # typecheck, then production build into dist/
npm test             # vitest, single run
npm run test:watch   # vitest, watch mode
npm run seed         # seed the live Firestore project (see Seeding below)
npm run deploy       # build + firebase deploy
```

Run a single test file or a single case:

```bash
npx vitest run src/services/__tests__/authService.test.ts
npx vitest run -t "decrements the balance exactly once"
```

Vitest is configured inside `vite.config.ts` (jsdom, `restoreMocks: true`), not a
separate config file. It only picks up `src/**/*.test.ts(x)`.

`npm run build` runs `tsc --noEmit` first, so a type error fails the build even
though Vite itself would transpile past it.

`npm run lint` exits clean: 0 errors and 205 warnings (mostly `no-explicit-any`
carried over from the port). The exit code is a real gate — a new *error* fails
CI — but treat the warning count as a baseline to chip at, not a pass/fail line.

`tsconfig.json` runs `strict: true`, and `@/*` is aliased to `src/*` in both
`tsconfig.json` and `vite.config.ts` (Vitest inherits it). Existing imports are
still relative; the rewrite is Phase 4 work.

## Environment

Copy `.env.example` to `.env.local` and fill it in. Three groups of vars:
`VITE_FIREBASE_*` (web app config, read by `src/services/firebase.ts`),
`VITE_CLOUDINARY_*` (the upload widgets still use Cloudinary), and the
`GOOGLE_APPLICATION_CREDENTIALS` / `FIREBASE_PROJECT_ID` / `SEED_*` group used only
by `scripts/seed.mjs`. The seed script runs via `node --env-file=.env.local`, so its
vars must be in that file — a shell export is not read.

There is no emulator setup in this repo. `firebase.json` declares no `emulators`
block and nothing in `src/` connects to one — development and tests run against
the real project (`kora-51711`, pinned in `.firebaserc`). The Vitest suite mocks
the Firebase SDK at the module boundary, so it is offline and touches nothing.

## Architecture

A React 19 + TypeScript + Vite SPA on Firebase (Auth + Firestore + Storage),
ported from an Electron + .NET version. `MIGRATION_PLAN.md` records the phase 1
decisions behind the data model (it is a pre-work plan, not a description of the
code — see its status header); `NEXT_MIGRATION_PLAN.md.pdf` is the phase 2 plan;
`README.md` covers setup, seeding and the live-project verification checklist.

Two files carry nearly all the non-UI logic: `src/services/api.service.ts`
(~1500 lines) and `src/services/authService.ts`.

### There is no backend — the security rules are the access control

Nothing sits in front of Firestore. `firestore.rules` is the only thing stopping
one employee reading another's salary, so any change to a read or write path has
to be checked against it. Rules resolve a caller's role from
`request.auth.token.role` (custom claim) and **fall back to a `get()` on
`users/{uid}`** when the claim is absent.

That fallback is load-bearing: custom claims are only ever set by
`scripts/seed.mjs` (`setCustomUserClaims`). The in-app linking actions —
`employeeAPI.setupUserAsEmployee` and `linkUserAsAdmin` in `api.service.ts` —
write `role` onto the user doc and nothing else, because a browser client cannot
mint claims. There is no Cloud Function in this repo. So users created through
the UI are authorised entirely through the document lookup.

### The read layer fans out; there are no joins

The old backend had page-shaped endpoints that ran SQL joins. `pageAPI` replaces
each one with parallel reads stitched in JS (`Promise.all`), and fields that
appear in *lists* are denormalised onto the listed document (`employeeName` on a
leave request, `fullName`/`email`/`profilePicture` copied from the user doc onto
the employee doc). When you write to one side of a denormalised pair, mirror it —
`updateEmpUserById` is the example to follow.

Every function returns `{ data, status }`, matching what components already
destructured off axios, so call sites did not change during the port.

### Two invariants that are easy to break

1. **A leave balance's document id *is* its leave type id**
   (`employees/{id}/leaveBalances/{leaveTypeId}`). This exists so that
   approve-and-decrement can run inside a single `runTransaction` — the client
   SDK cannot run queries inside a transaction, only direct document reads. If
   you ever key balances by anything else, the transaction stops working.
   `setLeaveRequestStatus` is the only place balances move; it computes a delta
   from the status transition, so re-approving an already-approved request is a
   no-op and moving *off* approved refunds the days. It deliberately does not
   clamp at zero — `OverBalanceConfirmModal` warns the admin, who may proceed.

2. **Enums are readable strings, defined once in `src/types/common.ts`**
   (`LeaveStatus.Approved = "approved"`). The stored Firestore values, the
   security rules, and the seed script's document ids all depend on these exact
   strings. String enums have no reverse mapping, so use the `*Labels` maps in
   that file for anything human-readable.

### Live reads vs one-shot reads

Employee screens subscribe where data moves underneath the user
(`subscribeToGatherings`, `subscribeToEmployeeLeave`). Everything else — all admin
screens, plus `EmployeeProfile` and the detail card on `EmployeeHome` — still uses
the one-shot `pageAPI` reads, so a page having a live sibling does not mean it is
live itself.

Both subscriptions go through `subscribePair`, which spans two sources
(`subscribeToEmployeeLeave` pairs the `leaveBalances` subcollection with top-level
`leaveRequests`) and **waits for both listeners before emitting** — emitting on the
first would render an empty half. They return an unsubscribe the page must call on
unmount, and errors (a denied read, a missing index) arrive on the error callback,
not as a rejected promise.

### Auth

`authService.ts` keeps the old .NET numeric result contract that the auth screens
branch on: `200` ok, `300` signed in but not linked to an employee/admin record,
`4xx`/`5xx` failure. `AuthContext` owns the session via `onAuthStateChanged` and
caches the `users/{uid}` doc per uid — call `invalidateCurrentUser()` (or the
context's `refresh()`) after anything that mutates that doc. `waitForAuthInit()`
exists because `auth.currentUser` is null for the first few hundred ms after a
page load; guards that skip it will bounce a signed-in user to the login screen.

`ProtectedRoute` (`requires: "admin" | "employee" | "any"`) reads role off the
context. A signed-in but unlinked user is redirected to `/#notlinked`.

Signup always writes `role: "unassigned"` and records what the user asked for as
`requestedRole` — the `users` create rule rejects any self-granted role or link, which
is the privilege boundary the whole rule set rests on. Email verification is sent but
**never enforced**: `isVerified` is carried on `CurrentUserDTO` and read by nothing.
Access is gated purely on an admin having linked the account.

### Firestore query changes need an index

Any new composite query (a `where` plus an `orderBy`, or `where` clauses on
different fields) needs an entry in `firestore.indexes.json`. At runtime a
missing one throws `failed-precondition` with a link that creates the index —
add it to the JSON file too, or it will be missing on the next project.

### PWA shell

The employee app is installable: `public/manifest.webmanifest`, `public/icons/`, and
`public/sw.js`, registered from `src/main.tsx` **only under `import.meta.env.PROD`** —
a service worker in front of the dev server breaks hot reload, so PWA behaviour can
only be tested against `npm run build` + `npm run preview`.

The service worker ignores cross-origin requests entirely, which is what keeps
Firestore's own persistence and Cloudinary out of a second cache. Build assets are
content-hashed so they are cache-first; navigations are network-first with the cached
shell as fallback. **If you change `public/sw.js`, bump the `CACHE` constant** or
clients keep the old worker's cache. `firebase.json` marks `/sw.js` and
`/manifest.webmanifest` `no-cache` so Hosting cannot pin an old shell after a deploy.

The icons are generated from `src/assets/logos/cori_logo_green.png` and still read
"Coriander"; `scripts/generate-icons.sh` regenerates them once a Kora logo exists.

## Conventions

- Ant Design is the component library; the theme token block lives in `App.tsx`.
  Tailwind and Bootstrap are also present, plus hand-written CSS in `src/styles/`.
- `src/dev/` holds unguarded dev-only scratch pages, served under `/dev/*`.
  `App.tsx` reaches them through a single lazy import on the
  `import.meta.env.DEV` branch, so Rollup drops the whole subtree from a
  production build — verified by no dev chunk appearing in `dist/assets`. Keep
  that shape: importing anything from `src/dev/` outside that branch ships it.
- `old-coriander-code/` holds a zipped snapshot of the pre-migration Electron
  frontend, kept locally for reference. The .NET backend was a separate repo and is
  not in it. It is gitignored and untracked — nothing
  builds from it.
- ESLint is still v8 with `.eslintrc.json`, and `@typescript-eslint` is pinned at
  v5. That blocks `eslint-import-resolver-typescript`, whose current release needs
  `@typescript-eslint/utils@^8`, so `import/no-unresolved` is configured to ignore
  `^@/` instead — `tsc` already resolves those paths, so nothing is lost. Moving to
  ESLint 9 flat config means upgrading both together.
- The rebrand is name-only so far. The components carry the Kora name (`KoraBtn`,
  `KoraBadge`, `KoraCircleBtn`) but the Tailwind palette and the logo are still
  Coriander's (`corigreen`/`sakura`/`warmstone`, `cori_logo_green.png`), as is
  user-facing copy in `UnlinkedMessage`.
