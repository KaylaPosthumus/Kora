# Kora

HR management system — React + TypeScript + Vite, backed by Firebase (Auth + Firestore).

Ported from the Electron/.NET version of Coriander. **`docs/migration-roadmap.md` is the
current forward plan**; `CLAUDE.md` is the orientation doc for the architecture and its
invariants. See *Where to read next* at the bottom for the rest.

## Setup

```bash
npm install
cp .env.example .env.local     # fill this in — see below
```

Create a Firebase project and enable **Authentication** (Email/Password + Google),
**Firestore** and **Storage** — profile pictures and review documents are uploaded
through `src/services/storageService.ts` under the two prefixes `storage.rules`
describes. Deploying `functions/` additionally needs the project on the **Blaze**
plan; Cloud Functions are not available on Spark.

`.env.local` has two groups, and the app needs the first to run:

- `VITE_FIREBASE_*` — the web app config, from **Project settings → Your apps**.
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
`firestore.rules`, `firestore.indexes.json`, `storage.rules` and `functions/`, whose
`predeploy` hook runs the backend's own `npm run build`. The functions package has a
separate dependency tree — run `npm --prefix functions install` at least once, since
the root `npm install` does not reach it.

## Where to read next

The README stops at running the thing. Everything else lives in `docs/`, one topic per
file, so that none of it drifts in two places at once.

| Document | What it covers |
| --- | --- |
| [`CLAUDE.md`](CLAUDE.md) | Architecture and the invariants that are easy to break. Start here. |
| [`docs/data-model.md`](docs/data-model.md) | Collections, the two data-layer conventions, where the API modules live |
| [`docs/whats-next.md`](docs/whats-next.md) | **Start here** — what to do next, and which parts need you rather than Claude |
| [`docs/migration-roadmap.md`](docs/migration-roadmap.md) | The full forward plan — what is done, what is next, and what not to do |
| [`docs/verification.md`](docs/verification.md) | Proving the app against a live Firebase project. Phase 2, still not done |
| [`docs/coriander-parity.md`](docs/coriander-parity.md) | Where every part of the old Coriander app ended up, and why the gaps exist |
| [`docs/migration-phase-1.md`](docs/migration-phase-1.md) | The phase-1 plan, kept as the record of *why* the data model looks like this |
| [`functions/README.md`](functions/README.md) | The backend: what each of the 15 functions does, and what it inferred |
| [`src/test/README.md`](src/test/README.md) | The test doubles, and the `vi.mock` hoisting pattern they need |

`docs/next-migration-plan-superseded.pdf` is kept only as history — it was written
before commits 9–16 and `docs/migration-roadmap.md` replaced it.

## Status, in one paragraph

The port is done and the backend is written: 630 tests pass across three packages,
`typecheck`, `lint` and `build` are clean locally. Two things are not done and both
matter. **Nothing has ever run against the live Firebase project** — the CLI holds no
credentials, and rules, indexes, functions and Hosting have never been deployed, so
every query shape and every rule is still unproven; `docs/verification.md` is the
runbook. And **CI has never passed** — the `verify` job fails at `npm ci` on the runner
while the same command succeeds locally. `docs/migration-roadmap.md` §5 has the detail
on both.
