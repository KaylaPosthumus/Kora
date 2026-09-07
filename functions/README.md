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
│   ├── shared/             # admin app singleton, batch chunking
│   ├── claims/             # syncRoleClaim
│   ├── employees/          # onEmployeeDeleted
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
| `onUserDeleted` | Auth user deleted (**v1**) | Removes `users/{uid}` and side records; unlinks the employee |
| `adjustLeaveBalance` | Callable (admin) | Corrects a balance, with a reason and an audit entry |
| `onLeaveTypeWritten` | Firestore `leaveTypes/{id}` written | Backfills new types onto existing employees; mirrors renames |
| `requestEmailVerification` | Callable | Issues a 6-digit code, queues the email |
| `confirmEmailVerification` | Callable | Checks the code, flips Firebase's `emailVerified` |

`onUserDeleted` is a v1 trigger because auth-account deletion has no v2
equivalent — `firebase-functions/v2/identity` only offers the blocking
`beforeUserCreated` / `beforeUserSignedIn` hooks. Mixing versions is supported.

## Before this can deploy

1. **The project must be on the Blaze plan.** Cloud Functions are not available
   on Spark. Nothing here has been deployed or run against `kora-51711`.
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

## Deliberately not done

- **Uploads still go to Cloudinary.** `storage.rules` now describes the two
  prefixes the migration lands against (`profilePictures/{userId}/…`,
  `reviewDocuments/{reviewId}/…`), but `ProfilePicUploadBtn.tsx` and
  `DocUploadWidget.tsx` are unchanged. Permitting a path nothing writes to is
  harmless and makes the swap a frontend-only change.
- **Nothing calls the verification callables yet.** The backend is complete and
  tested; adding the code-entry UI is frontend work.
