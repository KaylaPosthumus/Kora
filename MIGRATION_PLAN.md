# Migration Plan — Coriander HR → Web App + Firebase

> **Status: executed. This is the plan as written *before* the work, kept as the
> record of why the data model looks the way it does. It is not a description of
> the current codebase** — read `README.md` and `CLAUDE.md` for that, and
> `NEXT_MIGRATION_PLAN.md.pdf` for the phase 2 plan that follows it.
>
> All eight sequenced steps below landed, except that step 8 (deploying to Hosting)
> is configured but not yet run against the live project. Four things the plan says
> are now wrong or settled differently:
>
> - **Custom claims were never built.** The plan assumes a Cloud Function sets a
>   `role` claim at link time. There is no `functions/` directory. `setCustomUserClaims`
>   is called only by `scripts/seed.mjs`, so for every user created through the UI the
>   role lives only on `users/{uid}` and `firestore.rules` reaches it through a
>   document `get()` fallback. This is the largest gap between plan and code.
> - **`leaveBalances` is settled**, not the open question it reads as here: a
>   subcollection at `employees/{id}/leaveBalances/{leaveTypeId}`, where the document
>   id *is* the leave type id. The approve-and-decrement `runTransaction` structurally
>   depends on that, because the client SDK cannot query inside a transaction.
> - **`onSnapshot` shipped.** The plan calls it optional and "not required for parity";
>   the employee screens now subscribe through `subscribeToGatherings` and
>   `subscribeToEmployeeLeave`.
> - **The old Jest suite was deleted, not reworked**, and `VeriCodeForm` was never
>   ported rather than becoming dead code. A narrower Vitest suite replaced them, and
>   `VerifyEmailNotice` replaced the 6-digit code form.
>
> Of the four items under "What's explicitly NOT in this first migration", the mobile
> employee experience has since been done (employee side only) and the rebrand is
> name-only; Cloudinary and Cloud Functions are untouched, as planned.

**Goal of this first migration:** Take the existing Electron + React + TypeScript app and stand it up in a **new repo** as a plain **Vite web app**, with **Firebase** (Auth + Firestore + Storage) replacing the .NET/Render backend — in one pass.

**Reality check up front:** This is a *port*, not an edit. The React components are reusable. The entire data layer (auth + api services) is rewritten. Budget accordingly.

---

## The one thing that decides everything: page-endpoints vs. Firestore

The current backend exposes **page-shaped endpoints** — `pageAPI.getAdminDashboard(adminId)`, `getEmployeeProfile(id)`, `getAdminEmpDetails(id)`, etc. Each one runs server-side SQL joins and returns a single fat object with everything a screen needs (employee + leave balances + equipment + meetings + ratings, all pre-joined).

**Firestore has no joins.** You have three ways to replace each page-endpoint, and you'll mix them:

1. **Denormalize** — duplicate the data you need onto the document you read most. (e.g. store `employeeName` on each leave request so the admin list doesn't have to look up every employee.)
2. **Client-side fan-out** — read the employee doc, then read their leave/equipment/meetings collections in parallel and stitch in JS. Simple, fine for an internal HR tool's data volumes.
3. **Cloud Function** — a callable function that does the joins server-side, mimicking the old page-endpoint. Use sparingly, for the 2–3 genuinely heavy screens (admin dashboard aggregates).

**Recommendation:** default to **client-side fan-out** (option 2) for this app. The data volumes are tiny (one company's employees), fan-out reads are cheap, and it keeps you out of Cloud Functions until you actually need them. Denormalize only the fields that show up in *lists* (names, statuses).

**Two decisions dominate this migration** and both are made *before* you wire any screen: (1) how you replace the joined page-endpoints — settled above as fan-out; and (2) how you store the numeric enums — covered in the next section. Get both right at seeding time or you'll migrate data twice.

---

## The second decision: numeric enums (don't skip this)

`src/types/common.ts` defines ~11 enums, **all numeric**, all commented "matching the backend values": `LeaveStatus.Approved = 1`, `PayCycle.Monthly = 0`, `EmployType.Contract = 2`, etc. These integers are stored in the DB *and* compared against directly in the UI (`status === LeaveStatus.Approved`) across **37 files**.

When you seed Firestore you must choose:
- **(A) Keep the magic numbers** — store `status: 1`. Zero UI changes, but your Firestore documents are unreadable in the console (`status: 1` tells you nothing) and security rules that check status are cryptic.
- **(B) Switch to readable strings** — store `status: "approved"`. Self-documenting DB, clean rules, but you update the enum definitions and every comparison site.

**Recommendation: (B) strings, but keep the enum objects as the mapping layer** — redefine `enum LeaveStatus { Approved = "approved" }`. Because the comparisons go through the enum (`=== LeaveStatus.Approved`) rather than raw numbers, changing the enum *values* fixes most sites in one edit. Do this during seeding, before any screen is wired, or you'll be migrating data twice. This is the second-biggest decision after joins.

## Firestore data model (from your ER diagram)

Collections, top-level:

- `users/{userId}` — fullName, email, role (unassigned/employee/admin), profilePicture, isVerified. **googleId/password/verificationCode go away** — Firebase Auth owns those.
- `employees/{employeeId}` — userId, gender, dob, phone, jobTitle, department, salary, payCycle, lastPaidDate, employType, employDate, isSuspended.
- `admins/{adminId}` — userId.
- `equipment/{equipmentId}` — employeeId (nullable), name, categoryId, assignedDate, condition.
- `equipmentCategories/{categoryId}` — name.
- `leaveTypes/{leaveTypeId}` — name, description, defaultDays.
- `leaveRequests/{requestId}` — employeeId, leaveTypeId, startDate, endDate, comment, status. **+ denormalized: employeeName, leaveTypeName** (for the admin list).
- `leaveBalances/{balanceId}` — employeeId, leaveTypeId, remainingDays. *(Or nest under employee — see note.)*
- `meetings/{meetingId}` — adminId, employeeId, isOnline, location, link, startDate, endDate, purpose, requestedAt, status.
- `performanceReviews/{reviewId}` — adminId, employeeId, isOnline, location, link, startDate, endDate, rating, comment, docUrl, status.

**Modeling decisions to make (call these out as you go):**
- `leaveBalances` and `equipment` could be **subcollections** under `employees/{id}` instead of top-level. Subcollections are cleaner for "this employee's X" reads; top-level is better if admins query *across* all employees (e.g. all pending leave). Since admins do query across, keep **leaveRequests top-level**, but **leaveBalances as a subcollection** of the employee is reasonable.
- The old `Gathering` concept = meetings + performanceReviews merged in the UI. Keep them as **two collections**, merge client-side (as the app already does conceptually).
- IDs: the old backend used auto-increment ints. Firestore uses string IDs. Your interfaces type these as `number` — you'll change them to `string`. This ripples through ~every interface and component prop. Plan for it.

---

## Auth migration (`authService.ts`, 16 functions)

Firebase Auth **simplifies** this. What changes:

| Old (Render/.NET) | New (Firebase) |
|---|---|
| JWT in `localStorage`, manual Bearer header | Firebase SDK holds the session; `onAuthStateChanged` |
| Google OAuth via Electron BrowserWindow hack | `signInWithPopup(GoogleAuthProvider)` — no hack |
| Custom 6-digit email 2FA (`request-verification`, `register-verified`) | Firebase `sendEmailVerification` — **behaviour changes** (see risk) |
| `role` field from backend DTO | **Custom claims** on the Firebase user, set by a Cloud Function/admin script |
| Manual `getCurrentUser` polling backend | `auth.currentUser` + a `users/{uid}` doc read |

**The role/linked model needs care.** Today a user signs up → is "unlinked" → an admin links them to an employee record → they get access. In Firebase:
- Store `role` and `isLinked` on the `users/{uid}` Firestore doc (readable), and mirror `role` into **custom claims** (for security rules).
- The admin "link user as employee" action writes the employee doc + updates the user doc + (via a Cloud Function) sets the custom claim.
- Route guards read the role from the auth context instead of calling `navbarUserStatus()`.

**Functions that map cleanly:** login (email/Google), logout, getCurrentUser, isLinked check, redirect-if-logged-in.
**Functions that need rework:** the two `...Signup2FA` flows (custom verification codes → Firebase email verification), and anything setting role.

---

## Uploads (Cloudinary)

Two options:
- **Keep Cloudinary** — it already works in a browser (the widget is loaded in `index.html`, nothing Electron-specific). Lowest effort. Keep it for this first pass.
- **Move to Firebase Storage** — one less vendor, integrates with Firebase auth/rules. Do this *later* as a small isolated change, not in the first pass.

**Decision: keep Cloudinary for migration 1.** Don't add scope.

---

## Stripping Electron

Small and isolated — mostly deletion:
- **Delete:** `main.ts`, `preload.ts`, `forge.config.js`, all `vite.main/preload/renderer.config.ts`, `forge.env.d.ts`, and every `@electron-forge/*` + `electron` dependency.
- **`renderer.tsx` → `main.tsx`** as the standard Vite entry; `index.html` points to it (already does, basically).
- **`package.json` scripts:** `electron-forge start/make` → `vite` / `vite build` / `vite preview`.
- **The 3 auth pages** call `window.electronAPI?.startGoogleOAuth()`. Replace those call sites with Firebase `signInWithPopup`. Delete `global.d.ts`'s electronAPI type.
- **`import.meta.env`** already used — Vite env carries over. Rename `VITE_API_*` vars out; add `VITE_FIREBASE_*`.

---

## Sequenced steps (do them in this order)

1. **New repo scaffold.** Fresh Vite + React + TS project. Copy over `src/components`, `src/pages`, `src/interfaces`, `src/constants`, `src/utils`, `src/styles`, `src/assets`, `tailwind.config.js`, the Ant Design theme block from `App.tsx`. Do **not** copy `main.ts`/`preload.ts`/forge/electron configs. Get it to *compile* (it won't run yet — services are missing).

2. **Firebase project + SDK.** Create the Firebase project, enable Auth (Email/Password + Google), Firestore, Storage. Add `firebase` SDK, create `src/services/firebase.ts` (init + exports for `auth`, `db`, `storage`).

3. **Auth service rewrite.** Rebuild `authService.ts` against Firebase Auth. Build an `AuthContext` with `onAuthStateChanged` → replaces the manual token/`navbarUserStatus` plumbing. Wire route guards.

4. **Seed + security rules.** Write a seed script (Node + Firebase Admin SDK) to create `leaveTypes`, `equipmentCategories`, and a test admin + employee. Write Firestore security rules (role-based: employees read/write own data, admins read/write across). **Don't skip rules** — an internal HR tool has real PII.

5. **API service rewrite, one group at a time.** Rebuild `api.service.ts` as Firestore queries, group by group, verifying each screen as you go. Suggested order (simplest → hardest): equipmentCategories → leaveTypes → equipment → leaveRequests → meetings → performanceReviews → the `pageAPI` composite reads (fan-out) last.

6. **Kill the `pageAPI` endpoints.** Replace each with a client-side fan-out helper that reads the pieces in parallel (`Promise.all`) and stitches. This is where you'll spend the most time; the admin dashboard aggregates are the hardest.

7. **ID type sweep.** Change `number` IDs → `string` across interfaces and props. TypeScript will guide you — fix until it compiles clean.

8. **Deploy.** Firebase Hosting (`firebase deploy`). You get a URL, HTTPS, and Google OAuth's authorized-domain works out of the box.

---

## Risks & things that will bite you

- **Email 2FA behaviour change.** Your custom 6-digit-code flow becomes Firebase's email-verification-link flow. The UX is different (link vs. code) and the `VeriCodeForm` component/tests become dead code. Decide if that's acceptable or if you want to keep code-based verification (needs a Cloud Function + email provider — more work).
- **Server-side aggregates.** The admin dashboard computes top-5 ratings, employment-status distributions, etc. Doing these client-side means reading more docs; doing them "right" eventually means a Cloud Function or precomputed aggregate docs. Fine to do client-side first, know it's a scaling limit.
- **Leave-balance integrity.** Approving leave decrements a balance. On the old backend that's one server-side endpoint (`ApproveLeaveRequestById`) doing it atomically. In Firestore that atomicity is gone — the approve-and-decrement becomes **two writes you must wrap in a `runTransaction`** (or a Cloud Function). The UI already reads `remainingDays` for the over-balance warning, so the check stays client-side; it's the *write* that needs the transaction. Don't ship it as two separate `updateDoc` calls.

- **"Realtime" in the README is fiction — but it's a free win here.** The README advertises "WebSocket integration for live data updates"; the actual code has **no WebSockets** (only health-check polling and a code-countdown timer). So there's nothing realtime to *preserve*. Optional upside: Firestore's `onSnapshot` listeners give you live updates almost for free — e.g. the admin leave-request list or meeting-requests badge updating without a refresh. Not required for parity; a cheap enhancement once the reads work.
- **Security rules are not optional.** Without the old backend enforcing auth, Firestore rules *are* your access control. Budget real time for them and test them.
- **The test suite** (Jest, ~30 test files) mocks the old axios API. Those mocks break. Tests will need reworking or temporary skipping — don't let red tests block the port; fix them after screens work.
- **`.number` → `.string` IDs** touch 26 interface fields — tedious and easy to half-do. Slightly softer than it looks: many call sites *already* pass `id.toString()` to the API, so the string values are partly flowing already. Still do it as one deliberate sweep (change interfaces, let TypeScript surface every break), not ad hoc.

---

## What's explicitly NOT in this first migration

- Rebrand (logo/colours/name) — separate, do after.
- Mobile/employee redesign — separate, do after the data layer is stable.
- Cloudinary → Firebase Storage — later isolated change.
- Cloud Functions for aggregates — only if/when client-side reads hurt.

Keep this pass to: **new repo, no Electron, Firebase Auth + Firestore, Cloudinary kept, feature-parity with today.**
