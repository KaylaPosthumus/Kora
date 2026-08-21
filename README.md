# Kora

HR management system — React + TypeScript + Vite, backed by Firebase (Auth + Firestore).

Ported from the Electron/.NET version of Coriander. `MIGRATION_PLAN.md` records the
decisions behind the data model (phase 1); `NEXT_MIGRATION_PLAN.md.pdf` is the phase 2
plan that drives the work after it. `CLAUDE.md` is the orientation doc for the
architecture and its invariants.

## Setup

```bash
npm install
cp .env.example .env.local     # fill this in — see below
```

Create a Firebase project and enable **Authentication** (Email/Password + Google) and
**Firestore**. Storage does not need enabling yet: nothing writes to it, and
`storage.rules` denies everything — uploads still go to Cloudinary.

`.env.local` has three groups, and the app needs the first two to run:

- `VITE_FIREBASE_*` — the web app config, from **Project settings → Your apps**.
- `VITE_CLOUDINARY_*` — cloud name plus the two unsigned presets. Without them the
  profile-picture and review-document upload widgets fail.
- `GOOGLE_APPLICATION_CREDENTIALS`, `FIREBASE_PROJECT_ID`, `SEED_*` — read only by
  the seed script (see Seeding).

There is no emulator setup — development runs against the real project, pinned in
`.firebaserc`. The test suite mocks Firebase and touches nothing.

## Running

```bash
npm run dev          # vite dev server
npm run typecheck    # tsc --noEmit
npm run lint
npm run build        # typecheck + production build into dist/
npm test             # vitest, single run
npm run test:watch   # vitest, watch mode
```

## Tests

Vitest, in `src/services/__tests__/`. Firebase is mocked at the module boundary, so
the suite runs offline and does not touch the live project.

Three things are covered — the pieces where a silent regression is expensive:

- **`leaveTransaction.test.ts`** — approve-and-decrement. The balance moves exactly
  once, in the right direction, and only when the status crosses the approved
  boundary. Re-approving an already-approved request is a no-op (this is what stops
  a double-click spending the days twice), and an over-balance approval is allowed to
  go negative on purpose — `OverBalanceConfirmModal` warns the admin and they may
  still proceed, so the transaction must not silently clamp.
- **`authService.test.ts`** — the numeric result contract carried over from the old
  .NET service (200 ok / 300 signed-in-but-unlinked / 4xx-5xx failure) that the auth
  screens branch on, the redirect each role lands on, the user-doc cache, and the
  mapping from Firebase `auth/*` codes onto that contract.
- **`liveReads.test.ts`** — the `onSnapshot` subscriptions. Each spans two sources
  (`subscribeToGatherings` two top-level collections, `subscribeToEmployeeLeave` the
  `leaveBalances` subcollection plus `leaveRequests`), so the tests pin that nothing
  is emitted until both have delivered — emitting early renders an empty half. The
  teardown-on-unsubscribe and error-reaches-the-caller cases are asserted on
  `subscribeToGatherings` only; the equivalents for `subscribeToEmployeeLeave` are
  not covered.

## Seeding

The seed script creates the reference data (leave types, equipment categories), two
pieces of equipment and a sample leave request, plus a test admin and employee.

It runs as `node --env-file=.env.local scripts/seed.mjs`, so its settings must live in
`.env.local` — a shell export is not picked up. It needs both
`GOOGLE_APPLICATION_CREDENTIALS` (path to a service account key, downloaded from
**Project settings → Service accounts**) and `FIREBASE_PROJECT_ID`.

```bash
npm run seed
```

It is safe to re-run: every document is written with a deterministic id and merged, and
auth users are looked up by email before being created.

The seeded accounts are also the only users that ever get **custom claims** — see the
note under Data model.

## Installing on a phone

The employee app is a PWA — `public/manifest.webmanifest` plus a small service
worker, so employees can add it to their home screen and open it without browser
chrome. Both only take effect in a real build (`npm run build`); the service
worker is not registered in dev, where it would sit between Vite and the browser
and break hot reload.

The service worker is deliberately minimal. It ignores cross-origin requests
entirely, so Firestore keeps its own persistence and nothing serves stale HR data.
Vite's build assets are content-hashed, so those are cache-first — a new build
produces new URLs. Navigations are network-first with the cached shell as a
fallback, so a cold spot opens the app rather than a browser error page.

**The icons still say "Coriander."** They are generated from
`src/assets/logos/cori_logo_green.png`, the only logo in the repo. When the Kora
logo arrives, regenerate them and bump `CACHE` in `public/sw.js`:

```bash
./scripts/generate-icons.sh path/to/kora-logo.png
```

## Deploying

```bash
npm run deploy       # builds, then deploys
```

`npm run deploy` is `npm run build && firebase deploy`. Bare `firebase deploy` skips the
build and ships whatever is already in `dist/`, which is usually stale — reach for it
only with `--only` for rules and indexes.

`firebase.json` publishes `dist/` to Hosting with an SPA rewrite, and deploys
`firestore.rules`, `firestore.indexes.json`, and `storage.rules`. There is no
`functions` block — the app has no server-side code.

## Data model

Top-level collections: `users`, `employees` (with a `leaveBalances` subcollection),
`admins`, `equipment`, `equipmentCategories`, `leaveTypes`, `leaveRequests`, `meetings`,
`performanceReviews`.

Two conventions worth knowing before you touch the data layer:

- **Enums are readable strings** (`status: "approved"`, not `1`), defined in
  `src/types/common.ts`. Comparison sites go through the enum, so the values are
  changed in one place.
- **A leave balance's document id is its leave type id.** That is what lets
  approve-and-decrement run as a single `runTransaction` — the client SDK can't query
  inside a transaction, only read documents directly.

Screens that used to hit a joined page-endpoint now fan out: `pageAPI` reads the pieces
in parallel and stitches them in JS. Fields that appear in lists (`employeeName`,
`leaveTypeName`, `equipmentCategoryName`) are denormalised onto the listed document.

The employee screens read live where the data moves underneath the user.
`subscribeToGatherings` and `subscribeToEmployeeLeave` mirror the fan-outs above but
with `onSnapshot`, so a leave approval or a scheduled meeting appears without a refresh.
Each spans two sources — `subscribeToEmployeeLeave` the `leaveBalances` subcollection
plus top-level `leaveRequests` — and waits for both listeners before emitting; both
return an unsubscribe the page calls on unmount. The one-shot reads stay for the admin
screens and for the employee views that don't change on their own: `EmployeeProfile` and
the detail card on `EmployeeHome` still call `pageAPI`.

**Roles and custom claims.** `firestore.rules` reads a caller's role from
`request.auth.token.role` and falls back to a `get()` on `users/{uid}`. Only the seed
script ever calls `setCustomUserClaims` — the in-app linking actions
(`employeeAPI.setupUserAsEmployee`, `linkUserAsAdmin`) write the role onto the user doc
and nothing else, because a browser client cannot mint its own claims. So for every user
created through the UI the fallback is the only path, and each rule evaluation costs a
document read. Closing that is what phase 3's Cloud Function is for.

## Still on the list

- Uploads still go to Cloudinary; moving them to Firebase Storage is a separate change
  (`storage.rules` currently denies everything).
- Admin dashboard aggregates are computed client-side. If the employee count grows,
  move them into a Cloud Function or precomputed aggregate documents.
- The old Jest suite was not carried over — its mocks targeted the axios API. The
  Vitest suite above covers the leave transaction, the auth flow and the live-read
  subscriptions; the page-level fan-outs in `pageAPI` are still untested.
- No Cloud Function sets custom claims, so users created through the UI are authorised
  through a document read on every rule evaluation (see Data model).
- Email verification is sent but never enforced — nothing reads `isVerified`. Access is
  gated on an admin having linked the account.
- The mobile pass covered the employee side only; admin pages have essentially no
  breakpoints.
- `npm run lint` exits clean, with 205 `no-explicit-any`-style warnings left from the
  port still to chip at.
- The rebrand has not happened: the Tailwind palette is still `corigreen`/`sakura`/
  `warmstone`, the logo and the PWA icons are still the Coriander wordmark, and
  `CoriBtn`/`CoriBadge`/`CoriCircleBtn` keep the old name. That phase needs brand
  assets, not code.

## Verifying against the live project

**See `docs/phase-2-verification.md`** for the full runbook — a static pre-flight
audit that is already done, a screen-by-screen click-through matrix, the three things
static analysis could not settle, and the rule and transaction proofs. The short
version:

```bash
firebase login
firebase deploy --only firestore:rules,firestore:indexes,storage
npm run seed          # needs serviceAccountKey.json — see Seeding above
npm run dev
```

Then, with the dev server up:

1. Click through every screen and watch the console. A missing composite index throws
   a `failed-precondition` error containing a link that creates the exact index — add
   it to `firestore.indexes.json` rather than only clicking the link, or it will be
   missing on the next project.
2. Log in as the seeded employee and confirm they *cannot* read another employee's
   salary or leave; log in as the admin and confirm they can. The rules are the only
   access control in the app now, so prove they work rather than assuming.
3. Approve a real leave request and confirm the balance decrements exactly once.

The declared indexes in `firestore.indexes.json` cover every composite query currently
in `api.service.ts`, so step 1 should turn up nothing. One caveat: the equality-only
pairs — `meetings` on `adminId` + `status`, and the `adminId` variants of
`getGatherings` / `subscribeToGatherings` — have no index of their own and rely on being
a prefix of the three-field `(adminId, status, startDate)` index. That normally works,
but it is untested rather than proven, and step 1 is the cheapest place to find out
otherwise.

### Static audit already done

The rules were cross-checked against every call the employee pages make, which found
and fixed two writes the employee UI offers but the rules denied:

- `gender` was missing from the employees self-update allowlist, so saving the
  employee's own edit-details form (`EmpEditEmpDetailsModal` sends `fullName`,
  `gender`, `dateOfBirth`, `phoneNumber`) failed as a whole.
- `meetings` delete was admin-only, so an employee withdrawing their own unactioned
  meeting request was denied. It now matches the update rule — allowed only while the
  request is still `requested`.

One latent trap worth knowing: `updateEmpUserById` mirrors `fullName`, `email` and
`profilePicture` onto `users/{uid}`, but the users update rule only lets a non-admin
change `fullName` and `profilePicture`. No employee flow sends `email` today, so it
does not bite — but adding an email field to the employee's own edit form would fail
the whole batch, not just the mirror, because it commits atomically.

Rule changes are still unproven until deployed — step 2 above is what confirms them.
