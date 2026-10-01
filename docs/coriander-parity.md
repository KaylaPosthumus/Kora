# Coriander → Kora parity

**Every part of the old Coriander frontend is accounted for.** Nothing was lost by
accident: each gap traces to a decision recorded below.

Audited 2026-09-19 against `old-coriander-code/coriander-main.zip`, the archived
Electron frontend, at commit `83ac8f9`. That archive is gitignored and untracked —
see *Re-running this audit* at the bottom.

---

## The numbers

| Area | Coriander | In Kora | Gaps |
| --- | ---: | ---: | ---: |
| Pages | 19 | 19 | 0 |
| Components | 54 | 52 | 2 |
| API functions | 57 | 55 | 2 |
| `authService` functions | 16 | 11 | 5 |
| Interfaces | 14 | 14 | 0 |
| Utility declarations | 15 | 15 | 0 |
| Contexts | 2 | 0 | 2 |

Kora also carries **26 files with no Coriander counterpart** — listed at the end.

---

## Renamed, not lost

These read as "missing" in a name comparison and are not:

| Coriander | Kora |
| --- | --- |
| `CoriBadge` | `shared/components/KoraBadge.tsx` |
| `CoriBtn` | `shared/components/KoraBtn.tsx` |
| `CoriCircleBtn` | `shared/components/KoraCircleBtn.tsx` |
| `components/calender.tsx` | `features/dashboard/components/AdminCalendar.tsx` |
| `services/api.service.ts` | six feature `api/` modules + `shared/lib/firestore.ts` |
| `App.tsx` (245 lines) | `app/App.tsx` + `router.tsx` + `providers.tsx` + `theme.ts` |
| `src/renderer.tsx` | `src/main.tsx` — Electron called the React entry point the *renderer*; it is the same ten lines |

`src/main.ts` in the archive is **Electron's main process** — window creation, IPC,
and Google OAuth through a `BrowserWindow`. It shares a name with Kora's
`src/main.tsx` but does a different job; the two are not counterparts. The actual
counterpart of `main.tsx` is `renderer.tsx`, above.

---

## The gaps, and why each one exists

### 1. There is no server to poll

The old app ran against a .NET backend on Render and had to tell the user when it
was unreachable. Firestore has no equivalent state — the SDK queues writes and
retries — so everything built to report server health went with it.

- `healthCheckAPI.checkHealth`
- `setServerStatusCheck`
- `ServerStatusModal`
- `ServerStatusContext`
- `StartupLoadingScreen`

### 2. There is no Electron

- `src/main.ts` — the main process
- `src/preload.ts` — the `contextBridge` exposing `startGoogleOAuth` / `onGoogleToken`
  over IPC, which is how the old app did Google sign-in. `signInWithPopup` replaces
  the whole mechanism.
- `src/global.d.ts` — the `Window.electronAPI` declaration for that bridge; it dies
  with `preload.ts`
- `types/electron-squirrel-startup.d.ts`
- `AppInitializationContext`

### 3. Firebase replaces the JWT plumbing

Coriander held a JWT in `localStorage` and attached it to every axios call. Firebase
Auth owns the session, so the whole layer is gone rather than reimplemented.

- All of `services/tokenService.ts` (`TOKEN_KEY`, `tokenService`)
- `getSecuredUser` — fetched the user with a bearer token
- `loginWithGoogle(idToken, role)` — POSTed a Google ID token to the .NET server for
  exchange. `signInWithPopup` does this natively, so the call has no target.
  **Google sign-in itself is intact**: `Login` uses `fullGoogleSignIn`, `AdminSignUp`
  uses `adminGoogleSignUp`, `EmployeeSignUp` uses `employeeGoogleSignUp`.

### 4. Email verification was dropped

A product decision, taken 2026-09-19 (commit 51). Access is gated on an admin linking
the account, and nothing ever read whether an address was confirmed.

- `VeriCodeForm` → replaced by `SignUpComplete`, which states the one thing that is
  true after signup: the account exists and is waiting on an admin
- `requestEmailVerification`
- `employeeSignup2FA` / `adminSignup2FA` → `employeeSignUp` / `adminSignUp`

### 5. The Lottie stack was deleted

Commit 17. Two dependencies, five JSON animations (241 KB) and `types/lottie.d.ts`,
with **zero imports anywhere in `src/`**.

---

## What Kora has that Coriander did not

**Safety rails the old app had no equivalent of:** `ProtectedRoute` (route guards by
role), `ErrorBoundary`, a 404 page.

**Capabilities CoriCore had server-side but its frontend never exposed:**
`AdjustLeaveBalanceModal` and `leaveBalanceApi` — the admin path to correct a leave
balance. `LeaveValidationNotice` surfaces the overlap and balance checks the backend
performs, which no amount of client-side work could compute.

**Firebase-shaped replacements:** `AuthContext`, `services/firebase.ts`,
`storageService.ts` (Firebase Storage, replacing Cloudinary), `shared/lib/firestore.ts`,
`shared/lib/callable.ts`, and the six feature `api/` modules.

**Structural, from Phase 4 and later:** `app/router.tsx`, `app/providers.tsx`,
`app/theme.ts`, six `components/index.ts` barrels, and `ResponsiveTable` — which gave
the admin screens a phone layout they never had in Electron.

Not counted above: the whole of `functions/`, which has no Coriander frontend
counterpart by definition.

---

## The one thing this cannot check

**`old-coriander-code/` holds only the Electron frontend.** The .NET backend was a
separate repository (`WolfOWI/coriander-backend`, "CoriCore") and is not on disk. So
this audit proves frontend parity and nothing about server-side behaviour that never
surfaced in a frontend call — validation rules, cascades, computed aggregates.

`functions/` was reconstructed from the ER diagram, the old README's controller list
and the frontend's call sites, and `functions/README.md` flags which parts are
**inferred** rather than ported. If that repository is ever reachable, one read-through
of its controllers is still worth doing.

---

## Re-running this audit

`old-coriander-code/coriander-main.zip` is gitignored, so this does not work from a
fresh clone without it.

```bash
unzip -q -o old-coriander-code/coriander-main.zip -d /tmp/cori -x "coriander-main/docs/*"
OLD=/tmp/cori/coriander-main/cori-app/src
```

Then compare by declaration name rather than by file: the port renamed files freely,
so a path diff reports noise. What the audit above did, in order —

1. **Files by stem**, across **all** of the old `src/`, against all of the new one.
   The first run of this audit walked a list of category directories instead, and so
   never looked at the four files sitting at `src/` root — `main.ts`, `renderer.tsx`,
   `preload.ts` and `global.d.ts`. Three were genuinely dropped and one,
   `renderer.tsx`, was a rename that went unrecorded for two commits. Walk the tree,
   do not enumerate the folders you expect.
2. **API functions**: parse `export const xAPI = { … }` out of the old
   `api.service.ts` and grep each member name across `src/`.
3. **Declarations** in `authService`, `tokenService` and each `utils/*.ts`, including
   the `export { a, b, c }` form the old code uses — a regex keyed only on
   `export const` misses those files entirely and reports a false all-clear.
4. **Line-count ratio** on every matched pair, to catch a file that exists but is a
   stub. Only three fell below 55%, and all three were explained: `App.tsx` (split
   four ways), `VeriCodeForm` (deliberately replaced), and `main` (a false match
   between Electron's main process and a React entry point).
