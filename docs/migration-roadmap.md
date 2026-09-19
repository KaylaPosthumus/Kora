# Kora — Migration Roadmap

> **Supersedes `docs/next-migration-plan-superseded.pdf`.** That PDF was written before commits 9–16
> landed; three of its five phases have since moved. This is the current forward plan,
> written against the code as it stands on `migration/firebase` at commit `c6abf27`.
>
> `docs/migration-phase-1.md` stays as the phase-1 record — the *why* behind the data model.
> This document is the *what next*.
>
> **Last reconciled against the tree at commit `0be12a5` (2026-09-19.)** Phases 3 and 5
> are done; Phase 2 is still the blocking one and has never been run.

---

## 1. Where the migration actually stands

### The port is done

| Area | State | Evidence |
| --- | --- | --- |
| Pages | Complete parity | 19 pages, 1:1 with the Electron app (7 admin, 4 employee, 3 auth, 5 dev-only) |
| Components | Complete, minus three intentional drops | 53 vs 54. `ServerStatusModal`, `StartupLoadingScreen` (no server to poll), `VeriCodeForm` (email verification was later dropped entirely). Added `ProtectedRoute`, `SignUpComplete` |
| Data layer | Complete parity plus extras | All 11 API groups, 57 of 58 functions matched by name. Only `healthCheckAPI.checkHealth` dropped, correctly. Added `leaveTypesAPI`, `getAllEquipCategories`, two `onSnapshot` subscriptions |
| Auth | Firebase Auth, email + Google | Old .NET numeric contract (`200`/`300`/`4xx`) preserved so the auth screens didn't change |
| Access control | 7 helper functions, 10 match blocks | `firestore.rules` covers all 9 collections + `leaveBalances` subcollection + a collection-group read |
| Indexes | 7 composite indexes declared | Covers every composite query in `api.service.ts` |
| Build health | Green | `tsc --noEmit` clean in all three packages; **630 tests passing** — 183 app, 345 `functions/`, 102 `rules-tests/`. `lint` 0 errors / 221 warnings; production build succeeds |
| Backend | Complete | `functions/` deploys 12 functions — claims, cascades, denormalisation, leave balances. See Phase 5 |
| Mobile + PWA | Employee side shipped | Commits 12–14. Was "phase 5" in the PDF; it landed early |

### What has not happened

| Gap | Detail |
| --- | --- |
| **Nothing has run against the live project** | `firebase login:list` still reports no authorized accounts, and `serviceAccountKey.json` is absent, so `npm run seed` has never run. Rules, indexes, storage rules, **functions** and Hosting have **never been deployed**. This is unchanged since this document was first written, and it now gates more code than it did then |
| **The backend is written but has never run** | `functions/` is complete and tested offline. Its one remaining callable, `adjustLeaveBalance`, now has a client seam and a UI (commit 49), and `onLeaveRequestWritten`'s verdict is on screen (commit 50) — but nothing has been deployed, so none of it does anything in a browser yet |
| Deploying functions needs Blaze | Cloud Functions are not available on the Spark plan. Whether `kora-51711` is on Blaze is unverified — it cannot be checked without CLI credentials |
| A backend verdict nothing reads | `onLeaveRequestWritten` stamps a `validation` field (overlaps, insufficient balance) onto every leave request. No type in `src/` declares it and no screen reads it |
| Rebrand is name-only | Palette is still `corigreen`/`sakura`/`warmstone`; `cori_logo_green.png` referenced from 5 files; PWA icons generated from it still read "Coriander" |

### One blind spot, stated up front

`old-coriander-code/` contains **only the Electron frontend**. The .NET backend was a
separate repo (`WolfOWI/coriander-backend`, "CoriCore"). The backend surface below was
reconstructed from the frontend's call sites and the old README's API list — server-side
logic that never surfaced in a frontend call (validation, cascades, computed aggregates)
cannot be verified from what is on disk. If that repo is still reachable, one read-through
of its controllers is still cheap insurance.

**Frontend parity is audited and complete** — see
[`docs/coriander-parity.md`](coriander-parity.md), which traces every Coriander file,
API function and auth call to where it landed, or to the decision that dropped it.

---

## 2. Conventions

Adopt these before moving any file, so the restructure lands in one shape rather than two.

### Naming

| Kind | Convention | Example |
| --- | --- | --- |
| Directories | `camelCase`, plural when they hold a collection of like things | `features/`, `performanceReviews/` — **never** `performance_reviews` |
| React components | `PascalCase`, one component per file, filename = component name | `KoraBtn.tsx`, `LeaveBalanceBlock.tsx` |
| Route screens | `PascalCase`, `<Role><Noun>` | `AdminLeaveRequests.tsx` |
| Hooks | `camelCase`, `use` prefix, one hook per file | `useEmployeeLeave.ts` |
| API modules | `camelCase`, `<domain>Api.ts` — drop the `.service.` infix | `leaveApi.ts`, not `leave.service.ts` |
| Type modules | `camelCase` file, `PascalCase` exported type | `leaveRequest.ts` exports `LeaveRequest` |
| Enums | `PascalCase` singular, **string** values | `LeaveStatus.Approved = "approved"` |
| Utilities | `camelCase`, `<thing>Utils.ts` | `dateUtils.ts` |
| Stylesheets | `kebab-case` | `admin-dash.css`, not `adminDash.css` |
| Tests | colocated `__tests__/<subject>.test.ts` next to the subject | `features/leave/api/__tests__/leaveApi.test.ts` |
| Firestore collections | `camelCase` plural | `leaveRequests`, `equipmentCategories` |
| Cloud Functions | `camelCase`, verb first | `syncRoleClaim` |
| Root docs | `SCREAMING_SNAKE.md` — reserved for `README.md`, `CLAUDE.md` only | everything else goes in `docs/` as `kebab-case.md` |

Three violations to fix on the way through. Two are **done**:
`src/interfaces/performance_reviews/` (dissolved by step 1) and
`src/components/calender.tsx` (step 4 moved it to
`features/dashboard/components/AdminCalendar.tsx` — the component inside was already
called `AdminCalendar`). Still open: `src/services/api.service.ts` vs `authService.ts`,
which step 6 settles by deleting the barrel.

### Structural rules

1. **One folder per concept.** ~~`src/interfaces/` and `src/types/` are two folders
   doing one job.~~ **Done** — both are now `src/shared/types/`, 17 files, flat.
2. **A feature owns its vertical** — api, components, hooks, pages, types.
3. **Import direction is one-way.** A feature may import from `shared/` freely, and from
   another feature's `api/`, `types`, or its `components/index.ts` **barrel** — never a
   file beside that barrel. Enforce with `eslint-plugin-import`'s `no-restricted-paths`.

   *Amended during step 4.* The rule originally banned cross-feature component imports
   outright. Applied to the real dependency graph that pushed 20 of 54 components into
   `shared/`, because the admin employee-detail screen and both dashboards legitimately
   render gathering UI that `gatherings` owns. Ownership by domain with a published
   surface keeps `shared/` for genuinely generic UI (9 components) and leaves each
   feature owning its own; the boundary being enforced becomes "no deep imports" rather
   than "no imports".
4. **No file over ~400 lines.** Today five exceed it, led by `api.service.ts` at 1,500.
5. **Path aliases, not `../../..`.** `@/*` → `src/*` is already configured in
   `tsconfig.json` and `vite.config.ts`, and **no import uses it yet**: 310 imports
   climb two or more levels.

---

## 3. Target repo layout

```
Kora/
├── .github/workflows/ci.yml       # typecheck + lint + test          (Phase 3)
├── docs/
│   ├── migration-roadmap.md       # this file
│   ├── migration-phase-1.md       # the phase-1 plan
│   ├── data-model.md              # ← README §Data model
│   └── verification.md            # ← README §Verifying against the live project
├── functions/                     # Cloud Functions backend           (Phase 5)
│   ├── src/index.ts
│   ├── package.json               # its OWN deps — never shared with src/
│   └── tsconfig.json
├── public/                        # manifest, icons, sw.js
├── scripts/                       # seed.mjs, generate-icons.sh
├── src/
│   ├── app/                       # the shell: nothing domain-specific
│   │   ├── App.tsx
│   │   ├── router.tsx             # routes + React.lazy boundaries
│   │   ├── providers.tsx          # ConfigProvider + AuthProvider + ErrorBoundary
│   │   └── theme.ts               # the ~150-line antd token block, out of App.tsx
│   ├── features/
│   │   ├── auth/                  # api · components · hooks · pages · types.ts
│   │   ├── employees/
│   │   ├── leave/
│   │   ├── equipment/
│   │   ├── gatherings/            # meetings + performance reviews
│   │   └── dashboard/
│   ├── shared/
│   │   ├── components/            # KoraBtn, KoraBadge, charts, Navigation
│   │   ├── hooks/
│   │   ├── lib/                   # firebase.ts, firestore.ts (converters, subscribePair)
│   │   ├── types/                 # common.ts enums, *.d.ts
│   │   └── utils/
│   ├── assets/
│   ├── styles/
│   └── main.tsx
├── firebase.json · firestore.rules · firestore.indexes.json · storage.rules
├── CLAUDE.md · README.md
```

### Where `api.service.ts` goes

The 1,500-line file splits along boundaries the code already has — the 11 API groups:

| Current export | Destination |
| --- | --- |
| `empUserAPI`, `employeeAPI`, `userAPI`, `adminAPI`, `linkUserAsAdmin` | `features/employees/api/employeesApi.ts` |
| `empLeaveRequestsAPI`, `leaveTypesAPI`, `subscribeToEmployeeLeave` | `features/leave/api/leaveApi.ts` |
| `equipmentAPI` | `features/equipment/api/equipmentApi.ts` |
| `meetingAPI`, `performanceReviewsAPI`, `gatheringAPI`, `subscribeToGatherings` | `features/gatherings/api/gatheringsApi.ts` |
| `pageAPI.*` | split per screen into the owning feature's `api/` |
| converters, collection refs, `subscribePair`, `ApiResponse` | `shared/lib/firestore.ts` |

Keep `src/services/api.service.ts` as a barrel that re-exports everything for one commit,
so the split lands without touching a single call site. Delete the barrel in the commit
that rewrites imports.

---

## 4. Phases

### Phase 2 — Prove it against the live project **(blocking; do nothing else first)**

The data layer compiles and passes an offline suite that mocks the Firebase SDK at the
module boundary. Firestore query shapes, missing composite indexes, and security rules
only fail at runtime, against a real project. Everything downstream is built on the
assumption that this works, and that assumption is currently untested.

1. Fix `src/utils/pdfUtils.ts:12` **first** — it does
   `fetch("/src/assets/logos/cori_logo_green.png")`. Vite serves `/src` in dev, but the
   build hashes that file to `/assets/cori_logo_green-Bt0zpxRe.png`, so in production the
   fetch hits the SPA rewrite and gets `index.html` back. Payroll PDF export is broken in
   any deployed build. Replace with a static `import logo from "..."`.
2. `firebase login` — the CLI currently holds no credentials.
3. Firebase console → Project settings → Service accounts → Generate new private key →
   save as `serviceAccountKey.json` (already gitignored; `.env.local` already points at it).
4. `firebase deploy --only firestore:rules,firestore:indexes,storage`
5. `npm run seed`
6. `npm run dev`, then click through **every** screen with the console open. A missing
   composite index throws `failed-precondition` with a link that creates it — add it to
   `firestore.indexes.json` too, or it is missing on the next project.
7. **Prove the rules from both sides.** Log in as the seeded employee and confirm they
   *cannot* read another employee's salary or leave; log in as the admin and confirm they
   can. The rules are the only access control in this app.
8. **Prove the transaction.** Approve a real leave request, confirm the balance decrements
   exactly once; move it off approved and confirm the days are refunded.
9. `npm run deploy` — the first Hosting deploy. Then install the PWA on a real phone; the
   service worker only registers under `import.meta.env.PROD`, so this is the first time
   it has ever run.

**Watch item:** the equality-only queries — `meetings` on `(adminId, status)`, and the
`adminId` variants of `getGatherings`/`subscribeToGatherings` — have no index of their own
and rely on being a prefix of the three-field `(adminId, status, startDate)` index. That
normally works. Step 6 is the cheapest place to find out it doesn't.

**Exit criteria:** every screen renders against seeded data with a clean console; rules
proven from both sides; balance transaction proven; app reachable at the Hosting URL; any
index discovered at runtime committed to `firestore.indexes.json`.

---

### Phase 3 — Hygiene: delete, fix, tighten — **DONE** (2026-08-21)

All four groups landed. `npm run typecheck`, `npm run lint`, `npm test` and
`npm run build` all exit clean. Two notes on how it actually went:

- **`src/dev/` needed a different shape than planned.** Gating an array of `<Route>`
  elements behind `import.meta.env.DEV` still emitted five chunks to `dist/` — Rollup
  could not prove the module unused, because the `lazy()` and JSX calls at its top
  level read as side effects. Replaced with a single `/dev/*` route whose element is
  one lazy import living on the dead branch; that folds away cleanly. Confirmed by
  building and checking `dist/assets`.
- **`eslint-import-resolver-typescript` could not be installed.** Its current release
  needs `@typescript-eslint/utils@^8`; this repo pins v5. `import/no-unresolved` now
  ignores `^@/` instead, which costs nothing because `tsc` resolves those paths under
  `strict`. The ESLint 9 / typescript-eslint 8 / flat-config upgrade is deferred — it
  is a coordinated bump, not a hygiene item.

**3.1 Delete dead weight**
- `old-coriander-code/coriander-main (1).zip` — byte-identical to its sibling
  (both `sha256:64587d9a…`). 39 MB of exact duplicate.
- The entire Lottie stack, which has **zero imports anywhere in `src/`**: two dependencies
  (`@lottiefiles/dotlottie-react`, `lottie-react`), `src/assets/lottie/*.json`
  (5 files, 241 KB, `sleepingCat.json` alone is 144 KB), and `src/types/lottie.d.ts`.
- `dist/` and `firebase-debug.log` from the working tree (already gitignored).
- Decide on the five dev-only routes — `Temp*.tsx`, `Reference.tsx`, `apiPlayground/`
  (1,674 lines, all registered **unguarded** in `App.tsx` and shipped to production).
  Delete them, or move to `src/dev/` and register only under `import.meta.env.DEV`.

**3.2 Fix what production will hit**
- The `pdfUtils` bug, if Phase 2 step 1 hasn't already.
- Add a catch-all `<Route path="*">`. There is none — an unknown URL renders an empty `<main>`.
- Add an error boundary around `<Routes>`. A throw in any page currently white-screens the app.
- Delete the stale `// TODO: Get the actual admin ID from auth context` at
  `AdminMeetings.tsx:39` — the code below it already does exactly that.

**3.3 Tighten the toolchain**
- `tsconfig.json` has `"strict": false`. For an app whose only access control is a rules
  file, turn it on. If the error count is large, land `strictNullChecks` alone first.
- Add path aliases: `@/*` → `src/*` in `tsconfig.json` **and** `vite.config.ts`
  `resolve.alias`. 286 imports currently climb two or more levels.
- ESLint: drop `"plugin:import/electron"` — an Electron leftover in a browser app. Then
  drive the 2 errors to zero and chip at 205 warnings (56 `any` in `src/`). Consider the
  flat config; ESLint 8 with `.eslintrc.json` is a generation behind.

**3.4 CI** — there is no `.github/`. Add `ci.yml` running `typecheck`, `lint`, `test` on
push and PR. Do this *early*: it is what protects every phase after it.

**Exit criteria:** `npm run build` and `npm run lint` both exit clean; CI green on a PR.
The first two hold locally. **The third was never met and still is not** — see §5.

---

### Phase 4 — Restructure `src/` — **DONE** (2026-09-19)

All eight steps landed, one commit each (41–48), with `typecheck`, the 183 tests, `lint`
and the production build green between every one. `src/components/`, `src/pages/`,
`src/interfaces/`, `src/types/` and `src/services/api.service.ts` are all gone.

The one plan change worth knowing is in step 4: the cross-feature component rule was
amended to "no deep imports" with published barrels, rather than "no imports". §2 rule 3
records why.

The original plan text follows.

Only after Phase 2. A rules or index bug is far harder to attribute once 106 files have
moved — and that argument is stronger now than when it was written, because the backend
has never run either, and a trigger misfiring is harder still to attribute mid-restructure.

**Preconditions as verified on 2026-09-19, before step 1:** `interfaces/` (14 files)
and `types/` (3) were separate, `src/components/calender.tsx` and
`src/interfaces/performance_reviews/` carried their naming violations, `api.service.ts`
was 1,500 lines, and the `@/` alias was configured but used by zero imports while 310
climbed two or more levels. Nothing has drifted; the plan below
still applies as written.

What *has* changed since it was written is the safety net. There are now 630 tests across
three suites and CI runs all three, so a restructure that breaks behaviour is far more
likely to be caught than it would have been. Keep them green between every step.

Order, one commit per step, `npm run typecheck` green between each:

1. ~~**Merge `interfaces/` into `shared/types/`.**~~ **DONE.** All 17 modules — the 14
   from `interfaces/` plus `common.ts` and the two `.d.ts` files — now sit flat in
   `src/shared/types/`. The `performance_reviews` snake_case folder is gone, and the 63
   files that imported them were rewritten to `@/shared/types/…`, which is the first
   real use of the alias (step 6 does the rest).
2. ~~**Split `api.service.ts`** per the table in §3, keeping the old path as a re-export
   barrel.~~ **DONE.** 1,500 lines became six modules: `shared/lib/firestore.ts` (297 —
   envelope, collection refs, converters, `subscribePair`) and one `api/` module per
   feature. `pageAPI`'s five members moved into the feature whose screen each serves and
   are reassembled into the `pageAPI` object by the barrel, so zero call sites changed.
   Two modules are still over the ~400-line guide — `employeesApi.ts` (457) and
   `gatheringsApi.ts` (413) — which is the next thing to look at if either keeps growing.
   The barrel at `src/services/api.service.ts` is marked `@deprecated`; step 6 deletes it.
3. ~~**Lift the shell.**~~ **DONE.** The 247-line `src/App.tsx` is now four modules:
   `app/theme.ts` (the ~150-line Ant token block), `app/router.tsx` (nav, page frame,
   route table), `app/providers.tsx` (the wrapper stack) and `app/App.tsx` (24 lines of
   composition). Phase 8's Ant half is now a single-file edit, and `router.tsx` is the
   seam Phase 6's `React.lazy` needs. One deviation from the sketch above: the error
   boundary stays inside `<main>` in `router.tsx` rather than moving to `providers.tsx`,
   because wrapping the whole tree would take the navigation down with a throwing page.
4. ~~**Move components into features.**~~ **DONE.** All 54 components placed by domain
   ownership: 9 in `shared/components/` (KoraBtn, KoraBadge, KoraCircleBtn, Navigation,
   ErrorBoundary, the two charts, the two upload widgets) and 45 across the six features.
   Each feature publishes a `components/index.ts`; 28 imports now go through a barrel and
   **zero** reach into another feature's component files. `calender.tsx` became
   `features/dashboard/components/AdminCalendar.tsx` on the way through. Landed as one
   commit rather than one per feature — the import rewrite had to be atomic to keep
   `tsc` green.
5. ~~**Move pages into features.**~~ **DONE.** All 14 screens sit with their feature, so
   each owns both sides of its domain: `features/leave/pages/` holds
   `AdminLeaveRequests.tsx` and `EmployeeLeaveOverview.tsx` together, and the same for
   equipment, employees and gatherings. The split that mattered was the two home screens
   — `EmployeeHome` and `AdminDashboard` both went to `dashboard`, since each is its
   role's dashboard rather than a member of the domain it summarises. `NotFound` went to
   `app/`, not to a feature: it belongs to the shell that routes to it. `src/pages/` is
   gone.
6. ~~**Rewrite imports to `@/`** and delete the barrel.~~ **DONE.** `src/services/api.service.ts`
   is gone and its 35 consumers import from the owning feature's `api/` module directly;
   `pageAPI.getAdminEmpDetails(...)` call sites became plain calls to the exported
   function. 402 imports now use `@/` and **zero** climb a directory — the only relative
   specifiers left are `./` siblings, which is what the alias is meant to leave alone.
   Three test files moved with the code they test (`denormalisation` and
   `leaveTransaction` to their features, `liveReads` to `shared/lib`, since it exercises
   `subscribePair` through both of its real consumers), and the relative paths inside
   `vi.mock()` were aliased too — those are not import statements, so the first pass
   missed them, and a mock path that no longer resolves fails silently by not
   intercepting rather than by erroring.
7. ~~**Add the `no-restricted-paths` rule**~~ **DONE**, as `no-restricted-imports`.
   `import/no-restricted-paths` matches resolved *filesystem* paths, and every import in
   `src/` is now an `@/` alias that ESLint cannot resolve — the project has no
   `eslint-import-resolver-typescript`, which is why `import/no-unresolved` ignores `^@/`
   (see §Conventions). The core `no-restricted-imports` rule matches the literal
   specifier instead, so it works on aliases with no resolver at all. It bans
   `@/features/*/components/*` globally, and a per-feature `override` re-permits a
   feature's own components with a negated pattern. Proven in both directions rather than
   assumed: a cross-feature deep import errors, an intra-feature one does not.
8. ~~**Reorganise docs** into `docs/` per §3, and thin `README.md` down to setup + running.~~
   **DONE.** `MIGRATION_PLAN.md` → `docs/migration-phase-1.md`, `phase-2-verification.md`
   → `docs/verification.md`, the superseded PDF → `docs/`, and the data model extracted
   to `docs/data-model.md`. `README.md` went from 252 lines to 154: setup, running,
   tests, seeding, PWA install, deploying, then a table pointing at everything else. The
   root now holds only `README.md` and `CLAUDE.md`, which is what the naming convention
   in §2 reserves it for.

Use `git mv` throughout so blame survives. This phase changes no behaviour — if a test
result or a screen changes, something went wrong.

---

### Phase 4.5 — Wire the client to the backend's callables

Small, and the backend is idle until it happens. Three deployed functions have no caller.

1. **Initialise Functions.** `src/services/firebase.ts` exports `auth`, `db` and
   `storage` but never calls `getFunctions(app)`. Add it, and a thin
   `callable<TReq, TRes>(name)` wrapper that maps a thrown `HttpsError` onto the same
   `{ data, status }` contract the rest of the data layer returns — the numeric-status
   shape the screens already destructure. Do not let a second error convention in.
2. **`adjustLeaveBalance`** — the admin path to correct a balance that CoriCore had and
   this app has never had. It takes a reason and writes an audit entry to
   `leaveBalanceAdjustments`. The natural home is the individual-employee screen, next to
   the existing balance display.
3. ~~**The verification pair.**~~ **Resolved by deletion** (commit 51). Email
   verification is not a thing Kora does: access is gated on an admin linking the
   account, and nothing ever read whether an address was confirmed. The callables, the
   `mail` and `emailVerifications` collections and their rules are gone.
4. **Surface the `validation` verdict.** `onLeaveRequestWritten` stamps overlaps and
   insufficient-balance findings onto each leave request. Declare the field on the leave
   request type and show it in the admin review UI — it is advisory by design, so it
   belongs next to `OverBalanceConfirmModal`, not as a block.

---

### Phase 5 — Add the backend (`functions/`) — **DONE** (2026-09-19), except deployment

Landed across commits 25–38, and it grew well past the "just custom claims" trigger this
section originally scoped. `functions/README.md` is the reference; the summary:

**15 functions, in three groups.**

- *Authorisation* — `syncRoleClaim` (Firestore trigger on `users/{uid}`, not a callable,
  so every path that sets a role is covered) and `onEmployeeSuspensionChanged`, which put
  `role` / `employeeId` / `adminId` / `suspended` on the token.
- *Referential integrity* — `onEmployeeDeleted`, `onAdminDeleted`, `onUserDeleted`.
  The two deletions cascade **differently on purpose**: an employee's dependents are
  removed, an admin's are kept and only unlinked, because a performance review is a record
  about the employee and their history outlives the admin who ran it.
- *Denormalisation and domain logic* — the three-hop name-propagation chain
  (`onUserProfileWritten` → `onEmployeeProfileWritten` / `onAdminProfileWritten`),
  `onEquipmentCategoryWritten`, `onLeaveTypeWritten`, `onLeaveRequestWritten`,
  and `adjustLeaveBalance`.

**Three things it closed that were live bugs, not ports.** `onLeaveTypeWritten` backfills
balances, closing a hole where leave could be approved with the days silently never
deducted (`setLeaveRequestStatus` only decrements `if (balanceSnapshot.exists())`).
Rules now enforce `startDate <= endDate`, closing a self-service way to *grant* yourself
leave — an inverted range gives a negative duration, and `delta = -days` then **adds** to
the balance. And suspension, previously decorative, now gates an employee's writes.

**The architecture that makes it testable without an emulator:** each area splits into a
pure decision module with no Firebase imports, and a thin trigger that injects an Admin
SDK backend. 345 tests, no credentials, no network — consistent with the rest of the repo.

**No new indexes were needed.** Every query the backend runs is single-field equality (or
every one a single-field equality), so the automatic indexes cover it.

**What is left of this phase:**

1. **Deploy it.** Nothing here has ever run. This is part of Phase 2 now, not separate.
   The project must be on **Blaze** — Cloud Functions are unavailable on Spark.
3. ~~**Give the callables a client seam.**~~ **DONE** (commit 49): `getFunctions()` in
   `src/services/firebase.ts` and `shared/lib/callable.ts`, which maps a rejected
   `HttpsError` onto the `{ data, status }` envelope the rest of the data layer returns.
4. **Only if the dashboard feels slow:** move `pageAPI.getAdminDashboardData` aggregates
   server-side. `getAdminEmpManagement` reads *every* employee's leave balances via one
   collection-group query — correct at one company's scale, and the first thing to
   revisit if that stops being true.

**Settled here:** Storage. Commit 34 moved profile pictures and review documents off
Cloudinary onto Firebase Storage via `src/services/storageService.ts`; the Cloudinary env
vars are gone and `storage.rules` now governs real traffic. One capability was lost in the
move — the Cloudinary widget's cropping UI.

**Settled, by deletion:** email verification. It was sent and never enforced, and the
answer to "wire it up or drop it" was drop it (commit 51) — access is gated on an admin
linking the account, which is the control that was actually wanted.

---

### Phase 6 — Performance — **DONE** (2026-09-19)

First paint went from **1,929 kB gzipped to 395 kB** (235 entry + 123 firebase + 37 CSS),
and the login screen from ~5,300 kB to ~616 kB with images. The roadmap's target was
"initial JS under 500 KB gzipped"; it is 358 kB.

The counter-intuitive finding is in `vite.config.ts`, and it is worth not undoing:
**naming a package in `manualChunks` usually made things worse.** Splitting `antd` out
cost 189 kB gzipped on first paint, because forcing a package into one chunk defeats the
tree-shaking that leaves its unused parts behind. Naming `@mui/x-charts` was worse still
— it depends on `@mui/material`, as does every `@mui/icons-material` icon, so the chart
chunk became a static dependency of the entry and Vite preloaded 464 kB of charting for a
screen most users never open. Only `firebase` is named now.

What landed, against the original plan below: route-level `React.lazy` (14 of 15 screens;
Login stays eager as the landing route), `pdfmake` behind a dynamic import, both oversized
images converted to sized WebP, and the `sw.js` `CACHE` bumped so existing installs evict
the old 3.3 MB PNG. Bootstrap was dropped separately, in commit 56.

The original plan follows.

The employee app is an installable PWA, and it shipped **4.8 MB of JavaScript in
one chunk** plus 257 KB of CSS. After correctness, this was the biggest thing standing
between the app and the phones it was built for.

- **Route-level `React.lazy`** in `app/router.tsx` (Phase 4 creates the seam). Admin
  screens should not be in an employee's first paint.
- **`manualChunks`** in `vite.config.ts` — split `firebase`, `antd`, `@mui/x-charts`.
- **`pdfmake` behind a dynamic `import()`.** One file uses it (`pdfUtils.ts`, admin-only
  payroll export) and it is a heavyweight dependency in every user's bundle today.
- **Images.** `Auth_Background.png` is 3.3 MB at 2000×2000; `no_profile_image.png` is
  1.2 MB at 1024×1024 for an avatar that renders at ~96 px. Converted to WebP at display
  size these are roughly 100 KB and 8 KB — **~4.4 MB off the wire** for two files.
- ~~**Drop Bootstrap.**~~ **DONE** (commit 56). Note the stated reason was the weaker
  one: 226 kB of CSS sounds like a lot, but gzipped it was ~30 kB. The real problem was
  that Bootstrap's breakpoints disagree with Tailwind's — `lg` at 992px against 1024px —
  so the two dashboards changed layout at a different width from every other screen.
  CSS went from 255 kB to 35 kB (37 kB to 7 kB gzipped).
- Bump `CACHE` in `public/sw.js` on any change, or clients keep the old worker's cache.

**Target:** initial JS under 500 KB gzipped. Measure before and after each step.

---

### Phase 7 — Admin responsive — **DONE** (2026-09-19)

All 7 admin pages now carry breakpoints (2–20 each, against 0 before). The sidebar half
of the original plan needed nothing: `Navigation` is shared with the employee side and
has been a top bar plus bottom nav below `lg` since commit 12.

The table half produced `shared/components/ResponsiveTable.tsx`, which is the piece worth
knowing about. It renders an Ant `<Table>` at `lg` and up, and the same rows as stacked
cards below it — **without defining any card markup for a cell**. It calls each column's
existing `render` and stacks the results under that column's own `title`. So a screen has
one definition of how a cell looks and the phone view cannot drift from the desktop one,
which is what happens when a card view is hand-written beside a table. Pagination and row
clicks are wired from one definition for the same reason, and a column opts out of the
card with Ant's own `responsive: ["lg"]`.

Two pages needed no table work. `AdminDashboard` had 0 Tailwind breakpoints but was never
desktop-only: its grid was react-bootstrap's `Col xs/md/lg`, which already responded
(and became a Tailwind grid in commit 56).
`AdminCreateEmployee` already had `grid-cols-1 lg:grid-cols-3`.

`AdminIndividualEmployee` was the real work — 13 fractional widths, and the two halves
were pinned with `max-w` and `min-w` as well as `w`, so all three had to be moved behind
`lg:` or the column kept its width and overflowed the screen.

---

### Phase 8 — Rebrand

Cosmetic, isolated, and cheap **after** Phase 4 concentrates the theme in one file.
Blocked on brand assets, not on engineering.

- Tailwind palette: `corigreen` / `sakura` / `warmstone` → Kora tokens in `tailwind.config.js`.
- Ant Design token block — one edit in `app/theme.ts`.
- `cori_logo_green.png` is imported from 5 files; swap the asset, keep the import sites.
- Re-run `scripts/generate-icons.sh` — the PWA icons still render the Coriander wordmark
  even though `manifest.webmanifest` says "Kora HR".
- Copy sweep, starting with `UnlinkedMessage`.

---

## 5. Sequencing, and what not to do

```
Phase 2  Prove it live          ██████  BLOCKING — still not done; now gates the backend too
Phase 3  Hygiene                  ████  DONE (2026-08-21)
Phase 5  Backend (functions/)     ████  DONE (2026-09-19) — written and tested, not deployed
Phase 4  Restructure              ████  next, after 2
Phase 4.5 Wire the callables      ██    small; the backend is waiting on it
Phase 6  Performance              ████  DONE (2026-09-19) — 1,929 kB -> 395 kB gzipped
Phase 7  Admin responsive         ██    DONE (2026-09-19)
Phase 8  Rebrand                  ██    last; needs assets, not code
```

Phase 5 ran ahead of Phase 4 because bugs forced it — a leave-approval path that never
deducted days, and a rules gap that let an employee grant themselves leave. That was the
right call, but it means **Phase 2 now gates more code than when it was written**: the
backend has the same never-run-against-a-real-project status the data layer has.

- **Do not restructure before Phase 2.** Attributing a rules failure is much harder once
  106 files have moved.
- ~~**Do not rebrand before Phase 4.**~~ Unblocked: step 3 moved the theme block into
  `src/app/theme.ts`, so Phase 8's Ant half is now one file. It was 150 lines inside `App.tsx`
  and one file after; waiting turns a sweep into an edit.
- **Do not share one `node_modules` between `src/` and `functions/`.** Different runtimes.
  `rules-tests/` is a third tree. Each has its own lockfile and its own CI job.
- **Do not deploy the backend before reading `functions/README.md`.** Three of its
  functions cascade deletions and two rewrite custom claims. A first run against a seeded
  project is the right place to watch that, not a populated one.
- **Do not let a second error convention in** when Phase 4.5 wires the callables. The
  data layer returns `{ data, status }` everywhere; a raw thrown `HttpsError` reaching a
  screen would be the first exception to that.
- **CI is in place but has never passed.** All 17 push runs since commit 22 added it are
  red. The `backend` and `rules` jobs went green at commit 38; `verify` has failed at
  `npm ci` — step 4, before typecheck, lint, test or build ever run — on every single run.
  The same `npm ci` succeeds locally against the committed lockfile, so it is something
  about the Linux/Node-22 runner, and the log needs repo-admin auth to read. **Fix this
  before Phase 4**: a 106-file move without working CI gives up the one safety net that
  makes it safe.

---

## 6. Backlog — real, but not big enough for a phase

- `pageAPI` fan-outs are untested. The suite covers the leave transaction, the auth flow
  and the live-read subscriptions; the page-shaped reads that replaced the SQL joins are
  the largest untested surface.
- `getAdminEmpManagement`'s collection-group read grows with total employees rather than
  with the page. Correct today, worth a note in `docs/data-model.md`.
- The admin path to correct a leave balance now exists **server-side only** — the
  `adjustLeaveBalance` callable, with a reason and an audit entry. It has no UI and no
  caller. See Phase 4.5.
- 56 `any` in `src/`, concentrated in `AdminLeaveRequests` (6), `api.service.ts` (5) and
  `AdminDashboard` (5). The repo-wide lint warning count is 221.
- `storage.rules`'s `isAdmin()` reads `request.auth.token.role` by **dot access**, which
  Firestore rules cannot do safely — but Storage rules cannot `get()` Firestore, so there
  is no fallback to reach and an absent claim simply denies. That fails safe, and it makes
  `syncRoleClaim` plus a token refresh a *prerequisite* for admin uploads rather than an
  optimisation. Worth a rules-test tier of its own if Storage use grows.
- The phase-1 plan's status header and `README.md` now point here rather than restating
  the status (2026-09-19). Keep it that way: this file is the one place it lives.
