# Phase 2 — verifying against the live project

The data layer compiles and 43 offline tests pass, but the Vitest suite mocks the
Firebase SDK at the module boundary. **Nothing in this app has ever spoken to
Firestore.** Query shapes, composite indexes and security rules only fail at
runtime, against a real project.

This runbook is the systematic version of "click through every screen". Work top to
bottom; each section says what to do and what a failure looks like.

---

## 0. Static pre-flight — done, no live project needed

Every Firestore operation in `api.service.ts` and `authService.ts` was cross-checked
against `firestore.rules`, `firestore.indexes.json` and `scripts/seed.mjs`. The
README records an earlier pass over the *employee* pages; this one covers the admin
pages and the query/index/rule interactions.

**Clean:**

- **The signup write matches the create rule exactly.** `createUserDoc` writes
  `role: "unassigned"`, `isLinked: false`, and explicit `employeeId: null` /
  `adminId: null`. The rule tests all four with `.get(key, default)`, and its
  defaults are chosen so a *missing* key fails — so the explicit nulls are
  load-bearing, not decoration.
- **Neither Google path can run `createUserDoc` as an update.** Both
  `googleSignUpWithRole` and `fullGoogleSignIn` guard with `if (!existing.exists())`.
  This matters because `createUserDoc` uses `setDoc(..., { merge: true })`: on an
  existing document that is an *update*, and the update rule allows a non-admin to
  change only `fullName` and `profilePicture`, so it would be denied.
- **`EmployeeHome` calling `pageAPI.getAdminEmpDetails` is safe.** The name says
  admin, but all four reads are self-scoped — `employees/{id}`, equipment filtered
  by `employeeId`, that employee's `leaveBalances` subcollection, and gatherings
  filtered by `employeeId`. An employee passing their own id satisfies every rule.
- **Every `orderBy` field exists in the seeded data.** This is the quiet one: an
  `orderBy` on a field a document lacks *silently omits that document*, so a wrong
  field name shows up as an empty list rather than an error. Checked
  `fullName` on `employees` and `admins` (both `seedAdmin` and `linkUserAsAdmin`
  write it), `equipmentCatName`, `leaveTypeName`, `equipmentName`, `createdAt`,
  `startDate`.
- **Employee-side queries are all constrained to the caller.** Rules are not
  filters — a query is rejected outright if any document it returns fails the rule.
  Every employee query carries `where("employeeId", "==", <their own id>)`, so the
  result set is guaranteed to satisfy `isSelfEmployee(resource.data.employeeId)`.

**Three things static analysis cannot settle.** Ranked by how likely they are to
bite, these are what to watch for in step 4:

1. **The `(adminId, status)` prefix reliance.** `meetingAPI.getAllPendingRequestsByAdminId`
   and the `adminId` variants of `getGatherings` / `subscribeToGatherings` filter on
   `adminId` + `status` with no `orderBy`. There is no `(adminId, status)` index of
   its own — they rely on being a prefix of the three-field
   `(adminId, status, startDate)` index. That normally works. *Symptom if not:*
   `failed-precondition` on **Admin › Meetings** and the meeting-requests drawer.
2. **The unfiltered collection-group read.** `pageAPI.getAdminEmpManagement` runs
   `getDocs(collectionGroup(db, "leaveBalances"))` with no filter or ordering.
   Automatic single-field indexes are created with *collection* scope; whether the
   implicit `__name__` index covers a collection-group scan is not something the
   code can tell you. *Symptom if not:* `failed-precondition` on
   **Admin › Employee Management**, which is the whole table.
3. **The batch access-call limit in `setupUserAsEmployee`.** One `writeBatch`
   commits 1 employee doc + one `leaveBalances` doc per leave type (5 seeded) +
   one `equipment` update per item assigned + 1 user update. Firestore allows 20
   document-access calls per batched write, and `isAdmin()` costs an `exists()`
   plus a `get()` each time it runs. Duplicate reads of the same path are cached
   within a request, which should keep this to 2 — but if that caching does not
   span documents in a batch, assigning several items at creation time pushes past
   20. *Symptom:* the whole create-employee submit fails with permission-denied,
   not a partial write — batches are atomic. **Test it with at least 4 pieces of
   equipment attached**, not zero.

---

## 1. Prerequisites — these need you, not Claude

```bash
firebase login          # the CLI currently holds no credentials
```

Then Firebase console → **Project settings → Service accounts → Generate new private
key**, saved at the repo root as `serviceAccountKey.json`. It is already gitignored,
and `.env.local` already points `GOOGLE_APPLICATION_CREDENTIALS` at it.

Confirm before continuing:

```bash
firebase projects:list          # should list kora-51711
ls -l serviceAccountKey.json    # should exist
```

## 2. Deploy the rules, indexes and storage rules

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Index builds are asynchronous. Watch the console's Indexes tab until all seven show
**Enabled** — a query against a still-building index fails exactly like a missing one.

## 3. Seed

```bash
npm run seed
```

Creates 6 equipment categories, 5 leave types, an admin (`Ada Admin`) and an
employee, plus two pieces of equipment and a sample leave request. Safe to re-run:
document ids are deterministic and merged, and auth users are looked up by email
first.

The seeded accounts are the **only** users who ever get custom claims —
`setCustomUserClaims` is called nowhere else in the repo. Everyone created through
the UI is authorised by the `get()` fallback on `users/{uid}`. That difference is
worth exercising deliberately in step 5.

## 4. Click through every screen with the console open

`npm run dev`. A missing composite index throws `failed-precondition` with a link
that creates the exact index — **add it to `firestore.indexes.json` too**, or it is
missing on the next project.

| Screen | What it reads / writes | Watch for |
| --- | --- | --- |
| Login / signup | `users` create | The create rule — see pre-flight |
| Employee › Home | `getAdminEmpDetails` (self-scoped), `subscribeToGatherings` | Live updates arriving without a refresh |
| Employee › Leave | `subscribeToEmployeeLeave` — balances + own requests | `subscribePair` waits for both listeners; a half-empty render means one errored |
| Employee › Meetings | `subscribeToGatherings`, `deleteMeetingRequest` | Delete allowed only while status is `requested` |
| Employee › Profile | `getEmployeeProfile`, `updateEmpUserById` | The batch mirrors `fullName`/`email`/`profilePicture` onto `users` — see the latent trap below |
| Apply for leave | `getAllLeaveTypes`, `createLeaveRequest` | Must start `pending`; an employee cannot self-approve |
| Request meeting | `getAllAdmins`, `createMeetingRequest` | Admin dropdown populated ⇒ `orderBy("fullName")` on `admins` is fine |
| Admin › Dashboard | `getAdminDashboardData`, gatherings by month | `(status, createdAt desc)` + `limit(20)` |
| Admin › Employee Mgmt | `getAdminEmpManagement`, `toggleEmpSuspension` | **Watch item 2** — the collection-group read |
| Admin › Individual Emp | `getAdminEmpDetails`, `updateEmpUserById` | Leave balance ordering |
| Admin › Create Employee | `getUnlinkedUsers`, `setupUserAsEmployee` | **Watch item 3** — attach ≥4 equipment items |
| Admin › Equipment | `getAllEquipItems`, edit, unlink, assign, delete | `where("employeeId","==",null)` for unassigned |
| Admin › Leave Requests | pending/approved/rejected lists, approve/reject/reset | `(status, createdAt desc)` |
| Admin › Meetings | by-admin gatherings, pending requests drawer | **Watch item 1** — the `(adminId, status)` prefix |

**The latent trap, still unfixed:** `updateEmpUserById` mirrors `fullName`, `email`
and `profilePicture` onto `users/{uid}`, but the users update rule lets a non-admin
change only `fullName` and `profilePicture`. No employee-facing form sends `email`
today, so it does not bite — but adding an email field to the employee's own edit
form fails the *whole batch*, not just the mirror, because it commits atomically.

## 5. Prove the rules from both sides

The rules are the only access control in this app. Prove them rather than assume
them. With the seeded employee signed in, in the browser console:

```js
// Should FAIL — another employee's record.
await getDoc(doc(db, "employees", "<some other employee id>"));

// Should SUCCEED — their own.
await getDoc(doc(db, "employees", "<their own id>"));

// Should FAIL — the whole-collection read an admin screen does.
await getDocs(collection(db, "employees"));
```

Then repeat as the admin: all three should succeed.

Do the same check for a user **created through the UI** rather than seeded — that
user has no custom claim, so it exercises the `get()` fallback path in `isAdmin()`
and `myEmployeeId()`. If seeded accounts work and UI-created accounts do not, the
fallback is the difference.

## 6. Prove the leave transaction

`setLeaveRequestStatus` is the only place balances move, and it is the one piece of
genuine integrity logic in the app.

1. Note an employee's remaining days for a leave type.
2. Approve one of their requests. The balance decrements **exactly once**.
3. Approve the same request again. Nothing changes — the delta comes from the status
   *transition*, so re-approving is a no-op.
4. Move it back to pending. The days are refunded.
5. Approve a request for more days than remain. It goes negative on purpose —
   `OverBalanceConfirmModal` warns the admin, who may proceed.

## 7. First Hosting deploy

```bash
npm run deploy
```

Then open the Hosting URL on a real phone and install it. The service worker only
registers under `import.meta.env.PROD`, so this is the first time it has ever run.
Check the payroll PDF export from the admin side too — its logo path was broken in
every production build until commit 19, and this is the first build where that fix
is exercised.

---

## When something fails

- **`failed-precondition`** — a missing or still-building composite index. The error
  contains a link that creates it; add the same index to `firestore.indexes.json`.
- **`permission-denied` on a read** — the rule, or a query whose result set is not
  guaranteed to satisfy it. Rules are not filters.
- **An empty list with no error** — almost always an `orderBy` on a field those
  documents do not have.
- **A write that partially applied** — cannot happen here. Every multi-document write
  goes through `writeBatch` or `runTransaction`.

---

## Appendix — the employee-page rules audit

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

Rule changes are still unproven until deployed — step 5 above is what confirms them.
