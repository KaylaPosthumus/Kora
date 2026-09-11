# Kora backend (`functions/`)

The server-side half of the migration off CoriCore — the work a browser cannot
do. Ordinary CRUD stays in `src/services/api.service.ts`, which already has
parity with the old .NET API; nothing moved here just because it used to be a
controller.

> The CoriCore source is not available. `old-coriander-code/coriander-main.zip`
> holds only the Electron frontend and `docs/`. Everything here was
> reconstructed from `docs/er-diagram.png`, the old README's controller list and
> the frontend's call sites. Behaviour that never surfaced in a frontend call
> — server-side validation, cascades, computed aggregates — is **inferred**, and
> is flagged as such in the file that infers it.

## Layout

```
functions/
├── src/
│   ├── index.ts            # the deploy surface: one export per function
│   ├── shared/             # admin app singleton, chunking, cascade runner
│   ├── claims/             # syncRoleClaim
│   ├── employees/          # onEmployeeDeleted
│   ├── admins/             # onAdminDeleted
│   ├── equipment/          # onEquipmentCategoryWritten
│   ├── profile/            # the name-propagation chain
│   ├── users/              # onUserDeleted
│   ├── leave/              # adjustLeaveBalance, onLeaveTypeWritten
│   └── email/              # requestEmailVerification, confirmEmailVerification
└── package.json            # its OWN deps — never shared with the app
```

Each area splits the same way: a **pure decision module** (no Firebase imports)
and a **thin trigger** that injects an Admin SDK backend. That is what lets the
suite run with no emulator — see "Tests" below.

## The functions

| Function | Kind | What it does |
| --- | --- | --- |
| `syncRoleClaim` | Firestore `users/{uid}` written | Mirrors `role`/`employeeId`/`adminId` into custom claims |
| `onEmployeeDeleted` | Firestore `employees/{id}` deleted | Cascades to dependents; unlinks equipment and users |
| `onEmployeeSuspensionChanged` | Firestore `employees/{id}` written | Puts `isSuspended` on the token so the rules can act on it |
| `onAdminDeleted` | Firestore `admins/{id}` deleted | Unlinks gatherings **without deleting them** |
| `onEquipmentCategoryWritten` | Firestore `equipmentCategories/{id}` written | Mirrors a renamed category onto equipment |
| `onUserProfileWritten` | Firestore `users/{uid}` written | Hands name/email/picture down to employee and admin records |
| `onEmployeeProfileWritten` | Firestore `employees/{id}` written | Propagates a renamed employee to `employeeName` copies |
| `onAdminProfileWritten` | Firestore `admins/{id}` written | Propagates a renamed admin to `adminName` copies |
| `onUserDeleted` | Auth user deleted (**v1**) | Removes `users/{uid}` and side records; unlinks the employee |
| `adjustLeaveBalance` | Callable (admin) | Corrects a balance, with a reason and an audit entry |
| `onLeaveTypeWritten` | Firestore `leaveTypes/{id}` written | Backfills new types onto existing employees; mirrors renames |
| `onLeaveRequestWritten` | Firestore `leaveRequests/{id}` written | Stamps a verdict: overlaps, balance, date sanity |
| `requestEmailVerification` | Callable | Issues a 6-digit code, queues the email |
| `confirmEmailVerification` | Callable | Checks the code, flips Firebase's `emailVerified` |
| `cleanUpVerifications` | Scheduled, daily | Retires verification challenges nothing can use |

`onUserDeleted` is a v1 trigger because auth-account deletion has no v2
equivalent — `firebase-functions/v2/identity` only offers the blocking
`beforeUserCreated` / `beforeUserSignedIn` hooks. Mixing versions is supported.

## Before this can deploy

1. **The project must be on the Blaze plan.** Cloud Functions are not available
   on Spark, and `cleanUpVerifications` additionally needs Cloud Scheduler,
   which is Blaze-only too. Nothing here has been deployed or run against
   `kora-51711`.
2. **`npm --prefix functions install`** — the functions package has its own
   dependency tree. The root `npm install` does not reach it.
3. **For email to actually send, install the `firestore-send-email`
   extension** and point it at the `mail` collection. Until then,
   `requestEmailVerification` works and the messages accumulate in `mail`
   unsent — visible and replayable, not lost. The provider and its credentials
   live in the extension's config, deliberately not in this codebase.

`firebase deploy` from the repo root now ships functions too: `firebase.json`
has a `functions` block whose `predeploy` runs `npm run build`.

## The leave balance bug this closed

`setupUserAsEmployee` seeds one balance per leave type **at the moment an
employee is created**. Nothing kept that in step afterwards, so a leave type
added later reached nobody — and `setLeaveRequestStatus` decrements only
`if (delta !== 0 && balanceSnapshot.exists())`. An employee with no balance
document for a leave type could therefore have leave **approved with the days
silently never deducted**. `onLeaveTypeWritten` backfills, so the balance always
exists.

The same trigger mirrors `leaveTypeName` / `description` / `defaultDays` onto
existing balances when a leave type is edited. It never writes `remainingDays`:
that is the employee's own consumed state, and refreshing it from `defaultDays`
would hand back days already taken.

## Suspension was decorative

`Employee.isSuspended` is in the ER diagram, an admin toggles it through
`toggleEmpSuspension`, and the UI shows a "Suspended" badge — but nothing
enforced it. Every reference in `src/` is display: a badge, a line in the
payroll PDF, a dashboard tally. A suspended employee could still sign in, file
leave requests, request meetings and edit their profile.

**This one is inferred, not ported.** Without the CoriCore source there is no way
to check whether its middleware refused suspended users. What is certain is that
a button labelled "Suspend" that changes only a badge is not the intent.

The reading taken is the narrow one: suspension blocks an employee's **writes**
and leaves their **reads** alone, so they can still see their own record but
cannot file anything new. Admins are never gated — they have to be able to act on
a suspended employee. If that reading is wrong it is cheap to undo: one
`notSuspended()` helper in `firestore.rules` and seven call sites, all on write
branches.

The flag rides on the ID token rather than being read from the employee document
by the rules, because a `get()` on every evaluation is the cost `syncRoleClaim`
exists to avoid. The claim key sits outside `MANAGED_CLAIMS` so the two claim
writers compose rather than overwrite each other — there are tests for both
orderings.

## The name-propagation chain

CLAUDE.md states the rule — mirror both sides of a denormalised pair — and
`updateEmpUserById` follows it for the one pair it touches. Nothing kept the
rest in step, and the chain is two hops deep:

```
users.fullName ─┬─> employees.fullName ──> leaveRequests.employeeName
                │                          meetings.employeeName
                │                          performanceReviews.employeeName
                └─> admins.fullName ─────> meetings.adminName
                                           performanceReviews.adminName
```

So an employee who changed their name kept the old one on every leave request an
admin later reviewed, and `linkUserAsAdmin` copied `fullName` once at link time
and never again.

Three triggers, one per hop. Each gates on whether a watched field actually
moved before issuing any query, so an unrelated write — a salary change, a
suspension toggle — costs nothing. Nothing in the chain writes back to `users`,
so it terminates.

`users/{uid}` now has two triggers on it, `syncRoleClaim` and
`onUserProfileWritten`. That is supported and deliberate: they watch different
fields and write to different places.

## Why two deletions cascade differently

`onEmployeeDeleted` removes the dependents; `onAdminDeleted` keeps every one of
them and only nulls `adminId`. A leave request has no meaning without the
employee who filed it, but a performance review is a record **about the
employee** — its rating, comment and document are their history, and the admin
who ran it is incidental. Destroying an employee's review history because an
admin left would lose the more valuable half. `adminName` survives too, as the
historical fact of who conducted it.

The same reasoning splits leave types from equipment categories.
`onLeaveTypeWritten` deletes the balances of a removed leave type; leave types
are genuine data with no enum behind them. Equipment categories are the
opposite — `seed.mjs` creates them with ids matching the `EquipmentCategory`
enum, and `EquipmentTypeAvatar` switches on that enum rather than reading the
document. Equipment therefore keeps rendering with the category document gone,
and nulling `equipmentCatId` to "tidy up" would break the avatar and lose which
category an item is. That deletion is logged, not compensated for.

## Leave request validation, split two ways

`firestore.rules` enforces what one document can prove about itself:
`startDate <= endDate` (ISO strings sort lexicographically), and that
`employeeId` / `leaveTypeId` never change after creation.

The date ordering is not cosmetic. `calculateDurationInDays` is
`end.diff(start, "day") + 1`, so an inverted range gives a **negative** duration
— and `setLeaveRequestStatus` computes `delta = -days`, which for a negative
duration **adds** days to the balance on approval. Employees may amend the dates
of their own pending request, so before this rule that was a self-service way to
grant yourself leave. It is enforced on update as well as create, or the
amendment path reopens it.

`onLeaveRequestWritten` covers the two checks that need *other* documents, which
rules cannot query: overlapping requests, and whether the balance covers the
request. Those are **advisory** — over-drawing is a supported flow with its own
confirmation modal — so the verdict is written to the request's `validation`
field rather than blocking anything.

That trigger writes to the collection that fires it. The loop guard is that it
writes only when the verdict actually differs from the stored one, so its own
write causes exactly one more no-op invocation. The verdict deliberately holds
no timestamp: anything varying between runs would make every comparison unequal
and never terminate.

## Two gotchas worth knowing

**Claims do not appear until the ID token refreshes.** A newly linked employee
keeps a token with the old role for up to an hour. `syncRoleClaim` stamps
`userClaims/{uid}.refreshTime` after every change so the client can watch that
document and call `getIdToken(true)` — wiring that up in `AuthContext.refresh()`
is the outstanding frontend task. Until it exists nothing breaks: the `get()`
fallback in `firestore.rules` still authorises correctly, just with a document
read per rule evaluation.

**Storage rules have no such fallback.** Firestore rules can fall back to
`get(users/{uid})`; Storage rules cannot read Firestore at all, so `isAdmin()`
in `storage.rules` depends *only* on the claim. Before `syncRoleClaim` has run
and the token has refreshed, an admin is treated as an ordinary signed-in user
in the bucket. That fails safe — it never grants — but it makes the claim work a
prerequisite for the Storage migration, not merely an optimisation.

## Tests

```bash
npm --prefix functions test          # single run
npm --prefix functions run test:watch
```

There is no emulator, consistent with the rest of the repo. The decision
modules are pure and the orchestration modules take an injected backend, so
every test drives fakes — no credentials, no network, no emulator process.

The root Vitest config globs `src/**` **from the repo root**, so it never picks
up `functions/src`. The two suites are independent and can run side by side.

## Deliberately not built

- **No automated payroll advance.** `calculateNextPayDay` /
  `calculatePreviousPayDay` are display helpers for the payroll modal and PDF;
  `lastPaidDate` is set by an admin by hand. Nothing in the app or the surviving
  CoriCore evidence suggests a scheduled pay run, so adding one would be
  inventing a capability rather than migrating one.
- **No annual leave-balance reset.** Same reasoning: `defaultDays` exists, but
  nothing evidences a scheduled reset, and guessing an accrual policy is a
  business decision rather than a migration.
- **No meeting/review status *transition* rules.** Enum validity and date
  ordering are enforced,
  but which transitions are legal is not. Employees are already confined by the
  existing `onlyChanges` clauses, admins are trusted, and no bug demonstrates a
  need — so tightening further would risk breaking flows that cannot currently
  be tested against a live project.

## Deliberately not done

- **Uploads still go to Cloudinary.** `storage.rules` now describes the two
  prefixes the migration lands against (`profilePictures/{userId}/…`,
  `reviewDocuments/{reviewId}/…`), but `ProfilePicUploadBtn.tsx` and
  `DocUploadWidget.tsx` are unchanged. Permitting a path nothing writes to is
  harmless and makes the swap a frontend-only change.
- **Nothing calls the verification callables yet.** The backend is complete and
  tested; adding the code-entry UI is frontend work.
