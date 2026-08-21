# Kora — Migration Roadmap

> **Supersedes `NEXT_MIGRATION_PLAN.md.pdf`.** That PDF was written before commits 9–16
> landed; three of its five phases have since moved. This is the current forward plan,
> written against the code as it stands on `migration/firebase` at commit `c6abf27`.
>
> `MIGRATION_PLAN.md` stays as the phase-1 record — the *why* behind the data model.
> This document is the *what next*.

---

## 1. Where the migration actually stands

### The port is done

| Area | State | Evidence |
| --- | --- | --- |
| Pages | Complete parity | 19 pages, 1:1 with the Electron app (7 admin, 4 employee, 3 auth, 5 dev-only) |
| Components | Complete, minus three intentional drops | 53 vs 54. `ServerStatusModal`, `StartupLoadingScreen` (no server to poll), `VeriCodeForm` (replaced by `VerifyEmailNotice`). Added `ProtectedRoute`, `VerifyEmailNotice` |
| Data layer | Complete parity plus extras | All 11 API groups, 57 of 58 functions matched by name. Only `healthCheckAPI.checkHealth` dropped, correctly. Added `leaveTypesAPI`, `getAllEquipCategories`, two `onSnapshot` subscriptions |
| Auth | Firebase Auth, email + Google | Old .NET numeric contract (`200`/`300`/`4xx`) preserved so the auth screens didn't change |
| Access control | 7 helper functions, 10 match blocks | `firestore.rules` covers all 9 collections + `leaveBalances` subcollection + a collection-group read |
| Indexes | 7 composite indexes declared | Covers every composite query in `api.service.ts` |
| Build health | Green | `tsc --noEmit` clean, 43 tests passing across 3 files |
| Mobile + PWA | Employee side shipped | Commits 12–14. Was "phase 5" in the PDF; it landed early |

### What has not happened

| Gap | Detail |
| --- | --- |
| **Nothing has run against the live project** | Firebase CLI holds no tokens (last `firebase login` was cancelled 2026-08-21). `serviceAccountKey.json` is absent, so `npm run seed` has never run. Rules, indexes, storage rules and Hosting have **never been deployed** |
| **No backend exists** | No `functions/` directory. Custom claims are minted only by `scripts/seed.mjs`; every UI-created user is authorised by the `get()` fallback on `users/{uid}` |
| Three CoriCore capabilities unreplaced | Email API (6-digit 2FA) → Firebase link sent but `isVerified` is read by nothing. Image API → still Cloudinary; Firebase Storage is initialised and `storage.rules` written, but **zero application files import Storage**. LeaveBalance CRUD → no admin path to correct a balance |
| Admin side is desktop-only | 0 Tailwind breakpoints across all 7 admin pages (employee pages have 3–12 each) |
| Rebrand is name-only | Palette is still `corigreen`/`sakura`/`warmstone`; `cori_logo_green.png` referenced from 5 files; PWA icons generated from it still read "Coriander" |
| Bundle is 4.8 MB | One un-split JS chunk plus 257 KB CSS, on a PWA employees install on phones |

### One blind spot, stated up front

`old-coriander-code/` contains **only the Electron frontend**. The .NET backend was a
separate repo (`WolfOWI/coriander-backend`, "CoriCore"). The backend surface below was
reconstructed from the frontend's call sites and the old README's API list — server-side
logic that never surfaced in a frontend call (validation, cascades, computed aggregates)
cannot be verified from what is on disk. If that repo is still reachable, one read-through
of its controllers before Phase 5 is cheap insurance.

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

Three current violations to fix on the way through: `src/components/calender.tsx`
(lowercase **and** misspelled), `src/interfaces/performance_reviews/`, and
`src/services/api.service.ts` vs `authService.ts` (two conventions in one folder).

### Structural rules

1. **One folder per concept.** `src/interfaces/` and `src/types/` are two folders doing
   one job (14 files / 208 lines vs 4 files / 157 lines). They merge.
2. **A feature owns its vertical** — api, components, hooks, pages, types.
3. **Import direction is one-way.** A feature may import from `shared/` freely, and from
   another feature's `api/` or `types`. A feature may **never** import another feature's
   `components/`. Enforce with `eslint-plugin-import`'s `no-restricted-paths`.
4. **No file over ~400 lines.** Today five exceed it, led by `api.service.ts` at 1,500.
5. **Path aliases, not `../../..`.** There are currently 286 imports climbing two or
   more levels.

---

## 3. Target repo layout

```
Kora/
├── .github/workflows/ci.yml       # typecheck + lint + test          (Phase 3)
├── docs/
│   ├── migration-roadmap.md       # this file
│   ├── migration-phase-1.md       # ← MIGRATION_PLAN.md
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

---

### Phase 4 — Restructure `src/`

Only after Phase 2. A rules or index bug is far harder to attribute once 106 files have moved.

Order, one commit per step, `npm run typecheck` green between each:

1. **Merge `interfaces/` into `shared/types/`.** 14 files, 208 lines — the cheapest win,
   and it kills the `performance_reviews` snake_case folder.
2. **Split `api.service.ts`** per the table in §3, keeping the old path as a re-export
   barrel. Zero call sites change.
3. **Lift the shell.** `App.tsx` is 220 lines, ~150 of which are the Ant Design token
   block. Split into `app/App.tsx`, `app/router.tsx`, `app/providers.tsx`, `app/theme.ts`.
   This is also what makes Phase 8 a one-file edit.
4. **Move components into features**, one feature per commit. Fix `calender.tsx` →
   `features/dashboard/components/AdminCalendar.tsx` on the way through.
5. **Move pages into features.** `features/leave/pages/AdminLeaveRequests.tsx` and
   `features/leave/pages/EmployeeLeaveOverview.tsx` sit together — the feature owns both
   sides of its domain.
6. **Rewrite imports to `@/`** and delete the barrel.
7. **Add the `no-restricted-paths` rule** that enforces §2 rule 3, so the boundary holds.
8. **Reorganise docs** into `docs/` per §3, and thin `README.md` down to setup + running.

Use `git mv` throughout so blame survives. This phase changes no behaviour — if a test
result or a screen changes, something went wrong.

---

### Phase 5 — Add the backend (`functions/`)

**Trigger: custom claims.** Everything else the client-side fan-out already covers.

Today `firestore.rules` resolves a role from `request.auth.token.role` and falls back to
`get(/databases/$(db)/documents/users/$(uid))` when the claim is absent. Since
`setCustomUserClaims` is called only by the seed script, **every UI-created user takes the
fallback** — a document read on every rule evaluation, on every request.

1. `firebase init functions` (TypeScript). It gets its **own** `package.json` and
   `node_modules` — Cloud Functions run server-side on Node, separate from the browser
   bundle. Do not try to share one dependency tree.
2. Add a `functions` block to `firebase.json` so `npm run deploy` ships everything together.
3. Write **`syncRoleClaim`** as a Firestore trigger on `users/{uid}`, not a callable. The
   user document stays the single source of truth and the claim is derived from it, which
   means every path that sets a role — `setupUserAsEmployee`, `linkUserAsAdmin`, the seed
   script, a manual console edit — is covered by one function. A callable only covers the
   paths that remember to call it.
4. **Document the token-refresh gotcha.** A new claim does not appear until the ID token
   refreshes. The client must call `getIdToken(true)` after linking, or the user sits on a
   stale role until their token rotates (up to an hour). `AuthContext.refresh()` is where
   this belongs.
5. Keep the `get()` fallback in the rules as a safety net, but the claim becomes the
   primary path.
6. **Only if the dashboard feels slow:** move `pageAPI.getAdminDashboardData` aggregates
   server-side. `getAdminEmpManagement` reads *every* employee's leave balances via one
   collection-group query — a deliberate, documented choice that is correct at one
   company's scale and the first thing to revisit if that stops being true.

**Settle the Storage question in this phase.** `getStorage()` is initialised in
`firebase.ts`, `storage.rules` is written and deployed — and no application file imports
Storage. Uploads all go to Cloudinary via unsigned client-side presets. Either migrate
uploads to Firebase Storage (the rules start mattering, the Cloudinary env vars go) or
delete the `getStorage()` init and `storage.rules` and stay on Cloudinary deliberately.
Half-wired is the one option to avoid.

**Also a product decision, not a technical one:** email verification is sent and never
enforced — `isVerified` rides on `CurrentUserDTO` and nothing reads it. Either gate access
on it or drop the field.

---

### Phase 6 — Performance

The employee app is an installable PWA, and it currently ships **4.8 MB of JavaScript in
one chunk** plus 257 KB of CSS. After correctness, this is the biggest thing standing
between the app and the phones it was built for.

- **Route-level `React.lazy`** in `app/router.tsx` (Phase 4 creates the seam). Admin
  screens should not be in an employee's first paint.
- **`manualChunks`** in `vite.config.ts` — split `firebase`, `antd`, `@mui/x-charts`.
- **`pdfmake` behind a dynamic `import()`.** One file uses it (`pdfUtils.ts`, admin-only
  payroll export) and it is a heavyweight dependency in every user's bundle today.
- **Images.** `Auth_Background.png` is 3.3 MB at 2000×2000; `no_profile_image.png` is
  1.2 MB at 1024×1024 for an avatar that renders at ~96 px. Converted to WebP at display
  size these are roughly 100 KB and 8 KB — **~4.4 MB off the wire** for two files.
- **Drop Bootstrap.** `src/styles/index.css:1` imports the whole `bootstrap.min.css`.
  Only 4 files touch `react-bootstrap` and 1 uses Bootstrap classes. Porting those to
  Tailwind + Ant removes an entire CSS framework, and takes the app from four styling
  systems down to three.
- Bump `CACHE` in `public/sw.js` on any change, or clients keep the old worker's cache.

**Target:** initial JS under 500 KB gzipped. Measure before and after each step.

---

### Phase 7 — Admin responsive

The mobile pass covered the employee side only: 0 breakpoints across all 7 admin pages.
Same treatment as commits 12–14 — Ant `<Table>` becomes cards below `lg`, the fixed
sidebar becomes a drawer. Lower priority than 2–6 if admins work at desks; promote it if
they don't.

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
Phase 2  Prove it live          ██████  blocking — everything else assumes it
Phase 3  Hygiene                  ████  cheap, independent, do alongside 2
Phase 4  Restructure              ████  after 2, before 8
Phase 5  Backend (functions/)     ████  when claims or aggregates force it
Phase 6  Performance              ████  after 4 (needs the lazy-loading seam)
Phase 7  Admin responsive         ██    priority depends on how admins work
Phase 8  Rebrand                  ██    last; needs assets, not code
```

- **Do not restructure before Phase 2.** Attributing a rules failure is much harder once
  106 files have moved.
- **Do not rebrand before Phase 4.** The theme block is 150 lines inside `App.tsx` today
  and one file after; waiting turns a sweep into an edit.
- **Do not add `functions/` "just because."** Add it when claims or aggregates require it.
- **Do not share one `node_modules` between `src/` and `functions/`.** Different runtimes.
- **Do Phase 3.4 (CI) early.** It is the thing that protects every phase after it.

---

## 6. Backlog — real, but not big enough for a phase

- `pageAPI` fan-outs are untested. The suite covers the leave transaction, the auth flow
  and the live-read subscriptions; the page-shaped reads that replaced the SQL joins are
  the largest untested surface.
- `getAdminEmpManagement`'s collection-group read grows with total employees rather than
  with the page. Correct today, worth a note in `docs/data-model.md`.
- No admin path exists to correct a leave balance directly — balances are only created at
  employee setup and moved by the approve/decline transaction. CoriCore had CRUD here.
- 56 `any` in `src/`, concentrated in `AdminLeaveRequests` (6), `api.service.ts` (5) and
  `AdminDashboard` (5).
- `MIGRATION_PLAN.md`'s status header and `README.md`'s "Still on the list" overlap. Once
  this roadmap exists, both should point here instead of restating it.
