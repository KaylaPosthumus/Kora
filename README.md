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
```

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
- The old Jest suite was not carried over — its mocks targeted the axios API.
