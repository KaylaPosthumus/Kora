# Kora — data model

How the Firestore data is shaped, and the two conventions the data layer depends on.
Moved out of `README.md`; `CLAUDE.md` covers the architecture around it, and
`docs/verification.md` is how to prove any of it against a live project.

Top-level collections: `users`, `employees` (with a `leaveBalances` subcollection),
`admins`, `equipment`, `equipmentCategories`, `leaveTypes`, `leaveRequests`, `meetings`,
`performanceReviews`.

Two conventions worth knowing before you touch the data layer:

- **Enums are readable strings** (`status: "approved"`, not `1`), defined in
  `src/shared/types/common.ts`. Comparison sites go through the enum, so the values are
  changed in one place.
- **A leave balance's document id is its leave type id.** That is what lets
  approve-and-decrement run as a single `runTransaction` — the client SDK can't query
  inside a transaction, only read documents directly.

Screens that used to hit a joined page-endpoint now fan out: the page-shaped reads in
each feature's `api/` module — `getAdminEmpDetails`, `getAdminEmpManagement`,
`getEmployeeProfile`, `getAdminDashboardData`, `getEmployeeLeaveData` — read the pieces
in parallel and stitch them in JS. Fields that appear in lists (`employeeName`,
`leaveTypeName`, `equipmentCategoryName`) are denormalised onto the listed document.

The employee screens read live where the data moves underneath the user.
`subscribeToGatherings` and `subscribeToEmployeeLeave` mirror the fan-outs above but
with `onSnapshot`, so a leave approval or a scheduled meeting appears without a refresh.
Each spans two sources — `subscribeToEmployeeLeave` the `leaveBalances` subcollection
plus top-level `leaveRequests` — and waits for both listeners before emitting; both
return an unsubscribe the page calls on unmount. The one-shot reads stay for the admin
screens and for the employee views that don't change on their own: `EmployeeProfile` and
the detail card on `EmployeeHome` still use the one-shot page reads.

**Roles and custom claims.** `firestore.rules` reads a caller's role from the custom
claim and falls back to a `get()` on `users/{uid}` when the claim is absent. The in-app
linking actions (`employeeAPI.setupUserAsEmployee`, `linkUserAsAdmin`) write the role
onto the user doc and nothing else, because a browser client cannot mint its own claims;
the `syncRoleClaim` Cloud Function then derives the claim from that document, so the
user doc stays the single source of truth. A new claim does not reach the client until
its ID token refreshes, so `AuthContext` watches `userClaims/{uid}.refreshTime` and
forces `getIdToken(true)` when it moves. Until that lands the `get()` fallback still
authorises correctly, just at the cost of a document read per evaluation.

Claims are read in the rules through a `claim(key, default)` helper, never dot access —
dot access on an absent claim is an evaluation error, not a null, and it once denied
every employee write. `rules-tests/` pins that.


## Where the code lives

Since Phase 4 the data layer is one module per feature rather than a single
`api.service.ts`:

| Module | Holds |
| --- | --- |
| `shared/lib/firestore.ts` | the `{ data, status }` envelope, collection refs, document converters, `subscribePair` |
| `features/employees/api/employeesApi.ts` | employees, the users behind them, admins, linking |
| `features/leave/api/leaveApi.ts` | leave types, requests, balances, the approve/decline transaction |
| `features/equipment/api/equipmentApi.ts` | equipment and its categories |
| `features/gatherings/api/gatheringsApi.ts` | meetings, performance reviews, and the two merged |
| `features/dashboard/api/dashboardApi.ts` | the admin dashboard aggregates |
