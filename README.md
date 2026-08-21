# Kora

HR management system — React + TypeScript + Vite, backed by Firebase (Auth + Firestore).

Ported from the Electron/.NET version of Coriander. See `MIGRATION_PLAN.md` for the
decisions behind the data model.

## Setup

```bash
npm install
cp .env.example .env.local     # fill in your Firebase web app config
```

Create a Firebase project and enable **Authentication** (Email/Password + Google),
**Firestore**, and **Storage**. Copy the web app config into `.env.local`.

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

Two things are covered — the pieces where a silent regression is expensive:

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

## Seeding

The seed script creates the reference data (leave types, equipment categories) plus a
test admin and employee. It needs a service account key — download one from
**Project settings → Service accounts** and point `GOOGLE_APPLICATION_CREDENTIALS` at it.

```bash
npm run seed
```

It is safe to re-run: every document is written with a deterministic id and merged.

## Deploying

```bash
firebase deploy      # or: npm run deploy
```

`firebase.json` publishes `dist/` to Hosting with an SPA rewrite, and deploys
`firestore.rules`, `firestore.indexes.json`, and `storage.rules`.

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

## Still on the list

- Uploads still go to Cloudinary; moving them to Firebase Storage is a separate change
  (`storage.rules` currently denies everything).
- Admin dashboard aggregates are computed client-side. If the employee count grows,
  move them into a Cloud Function or precomputed aggregate documents.
- The old Jest suite was not carried over — its mocks targeted the axios API. The
  Vitest suite above covers the leave transaction and the auth flow; the page-level
  fan-outs in `pageAPI` are still untested.
- Employee pages have had no real responsive pass yet — that is the mobile phase.

## Verifying against the live project

The data layer compiles and the offline suite passes, but Firestore query shapes,
missing composite indexes, and security rules only fail at runtime — against a real
project. Work through this before building anything new on top:

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
in `api.service.ts`, so step 1 should turn up nothing — but it is the cheapest place
to find out otherwise.
