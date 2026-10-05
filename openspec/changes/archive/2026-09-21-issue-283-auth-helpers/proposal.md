# Proposal: Centralizar helpers de autorización server-side (issue #283)

**Change slug:** `auth-centralizar-helpers-server-side`
**Phase:** propose
**Status:** ready for spec + design

## 1. Why

TravelHub already owns a server-side authorization toolkit: `src/lib/auth/roles.ts`
(`normalizeRole`, `hasRole`, `canAccessFeature`, `getCurrentAccount`,
`getCurrentUserRole`, `getCurrentTravelAgentId`, `requireRole`, `requireFeature`,
`requireAdmin`) plus the feature catalog in `src/lib/auth/features.ts`. The
problem is not missing helpers — it is inconsistent adoption and three
overlapping enforcement styles:

1. **Middleware path gate.** `src/middleware.ts` (`matcher: ["/dashboard/:path*"]`)
   checks session + role only, via `src/lib/supabase/middleware.ts`. It never
   evaluates feature access, it is path-based (it cannot express per-action
   intent), and today it is the *only* thing standing between an authenticated
   agent and several mutating actions. A matcher change, a new entry point that
   is not under `/dashboard/**`, or a direct Server Action invocation from a
   client bundle all reach the same action code with no in-function
   authorization.
2. **Redirect-style guards in pages** (`requireFeature` / `requireAdmin`). Correct
   for Server Components, but they protect *rendering*, not mutations.
3. **Throw-style `requireRole` in a handful of actions.** Only `visas` actions
   (`src/app/dashboard/visas/[id]/actions.ts` x8, `visas/new/actions.ts`) and two
   of the 48 actions in `src/app/dashboard/trips/[id]/actions.ts` use it.
   Everything else listed in Impact has **no per-action check at all**.

Two more leaks compound this:

- Raw `supabase.auth.getUser()` is called outside the helper in
  `src/app/dashboard/layout.tsx:21-24` and
  `src/lib/supabase/middleware.ts:30-43`.
  (`src/app/login/actions.ts` is the credential-exchange boundary and does not
  call `getUser()`.)
- The profile lookup + role normalization is duplicated between
  `src/lib/auth/roles.ts` (`getCurrentAccount`) and
  `src/lib/supabase/middleware.ts`, so the middleware gate and the application
  guards can silently disagree.

**Core insight:** authorization must live next to the operation it protects, not
only in a path gate. Middleware remains a useful coarse navigation gate, but it
is not a reliable boundary for Server Actions. This change centralizes the
remaining raw auth access and completes — for the enumerated dashboard action
families — the adoption of the existing helpers. It also adds a non-throwing
admin predicate so actions that return typed `{ ok:false }` errors need no
try/catch, and adds an authenticated-user helper (`requireUser()`-style) so
actions and route handlers have one canonical entry point.

## 2. What Changes

- **Extend `src/lib/auth/roles.ts`** with:
  - `getCurrentUser()` — non-throwing identity helper (`User | null`) for places
    that render identity (dashboard layout).
  - `requireUser()` — throw-style helper that throws `Error("Unauthorized")` when
    there is no authenticated session; for Server Actions and Route Handlers.
  - `isCurrentUserAdmin()` — non-throwing `Promise<boolean>` predicate for
    actions that return discriminated-union errors.
- **Extract one shared profile resolver** into a Next-API-free module
  (`src/lib/auth/profile.ts`) exposing `resolveAccountProfile(client, userId)`
  plus `normalizeRole`. `getCurrentAccount()` and
  `src/lib/supabase/middleware.ts` both delegate to it, so role normalization and
  feature filtering cannot drift between the middleware gate and app guards.
  `normalizeRole` stays re-exported from `roles.ts` (public API unchanged).
- **Route the raw `auth.getUser()` in `src/app/dashboard/layout.tsx`** through
  `getCurrentUser()`. `src/app/login/actions.ts` (credential exchange) and the
  middleware session refresh stay as explicit authentication-boundary
  exceptions; the middleware must call `getUser()` on the raw client to refresh
  the cookie session.
- **Add `await requireRole("admin", "agent")` as the first statement** of every
  mutating Server Action in the unguarded families: clients, clients/[id],
  suppliers, travel-agents, trips/new, trips/[id] (trip detail), dashboard
  status actions, wcc/knowledge, and settings (`updateSettingsAction` only;
  `signOutAction` stays unguarded). In `trips/[id]` this covers the ~46 exported
  actions that today have no explicit guard, and `assertTripEditable` stays as an
  editability check that is orthogonal to authorization.
- **Replace the inline admin check** in
  `src/app/dashboard/settings/accounts/actions.ts:27-29` with
  `isCurrentUserAdmin()`, preserving its exact current behavior: a non-admin
  caller gets `{ ok: false, error: "No autorizado." }` and no write. This keeps
  the typed-error contract without try/catch.
- **Keep semantics explicit:** throw-style helpers for Server Actions and Route
  Handlers; redirect-style (`requireAdmin` / `requireFeature`) only for Server
  Components/pages. No UX change to any existing page.
- **Documentation freshness per the README truth-source table:** update the auth
  sections of `architecture.md`. `Changes.md` is not touched (no user-visible
  behavior change); `project.md`, `PRODUCT.md`, `DESIGN.md`, `doc/adr/`, and
  `doc/whatsapp-inbound-agent-architecture.md` are unaffected.

## 3. Scope

### IN scope

- The helper surface and its tests in `src/lib/auth/roles.ts`,
  `src/lib/auth/profile.ts`, and `src/lib/__tests__/`.
- Shared profile resolution adopted by `src/lib/supabase/middleware.ts`
  (return shape of `updateSession` unchanged; `src/middleware.ts` untouched).
- Identity helper adoption in `src/app/dashboard/layout.tsx`.
- `requireRole` guards for the enumerated unguarded dashboard action families,
  one reviewable group per family, each with its colocated
  `__tests__/*.test.ts`.
- `isCurrentUserAdmin()` adoption in
  `src/app/dashboard/settings/accounts/actions.ts` and its test.
- `architecture.md` auth-section updates.

### OUT of scope

- **New roles or role-model changes.** Behavior stays mono-admin today (parent
  epic #279). The allowed-roles parameter of `requireRole(...allowed)` is the
  documented extension point; it is not extended here.
- **Feature-level per-action enforcement.** Actions gain a role check; feature
  enforcement stays at the page/route layer. See Risks.
- **Client portal auth** (`src/lib/client-auth.ts`) — a separate concern.
- **Route handlers with separate credentials** — MCP API key, `CRON_SECRET`,
  WhatsApp webhook HMAC — except where a user-session handler exists.
- **`signOutAction`** — must remain callable without a role check.
- **Rewriting middleware to enforce features** (issue #304 decision: middleware
  keeps the role-only check). This change only makes its role resolution shared.
- **Mock-mode parity** — mock-mode auth was removed from middleware/roles/client
  auth in issue #372 phase 5; this change does not reintroduce it.

### Deferred / later slices

- Feature-level per-action enforcement for actions inside feature areas.
- Optionally collapse the double account fetch (page `requireFeature` + action
  `requireRole`) into a single request-scoped cache.

## 4. Impact

### Capabilities affected

- **`account-roles`** (ADDED + MODIFIED): the helper surface and enforcement-style
  contract (throw for actions/handlers, redirect for pages), `requireUser()`,
  the non-throwing `isCurrentUserAdmin()` predicate, and the single
  account-resolution path shared with middleware.
- **`auth-admin`** (ADDED + MODIFIED): the Server Action authorization boundary
  (middleware is a navigation gate, not the action boundary), the sign-out
  exemption, and the shared role resolution used by the middleware.

### Files touched

| File | Change |
|------|--------|
| `src/lib/auth/profile.ts` | Create: `normalizeRole` + `resolveAccountProfile(client, userId)`, no `next/headers`/`next/navigation` imports. |
| `src/lib/auth/roles.ts` | Add `getCurrentUser`, `requireUser`, `isCurrentUserAdmin`; delegate resolution to `profile.ts`; re-export `normalizeRole`. Existing helper semantics unchanged. |
| `src/lib/__tests__/roles.test.ts` | RED tests for the new helper surface. |
| `src/lib/__tests__/profile.test.ts` | New: pure resolver normalization/filtering matrix. |
| `src/lib/__tests__/supabase-middleware.test.ts` | Extend: middleware resolves role through the shared resolver. |
| `src/lib/supabase/middleware.ts` | Replace the duplicated profile query with `resolveAccountProfile`; return shape unchanged. |
| `src/middleware.ts` | Not touched. |
| `src/app/dashboard/layout.tsx` | `supabase.auth.getUser()` → `getCurrentUser()`. |
| `src/app/dashboard/__tests__/layout.test.tsx` | Update the `@/lib/auth/roles` mock for `getCurrentUser`. |
| `src/app/dashboard/clients/actions.ts` | `requireRole("admin","agent")` on `createClientAction`, `deleteClientAction`. |
| `src/app/dashboard/clients/[id]/actions.ts` | `requireRole` on all 8 exported actions. |
| `src/app/dashboard/suppliers/actions.ts` | `requireRole` on all 5 exported actions. |
| `src/app/dashboard/travel-agents/actions.ts` | `requireRole` on all 3 exported actions. |
| `src/app/dashboard/trips/new/actions.ts` | `requireRole` on `createTripAction`. |
| `src/app/dashboard/trips/[id]/actions.ts` | `requireRole("admin","agent")` as first statement on the ~46 exported actions that lack an explicit guard; `assertTripEditable` unchanged as an editability check. |
| `src/app/dashboard/actions.ts` | `requireRole` on `moveTripStatusAction`, `bulkUpdateTripStatusAction`. |
| `src/app/dashboard/wcc/knowledge/actions.ts` | `requireRole` on all 3 exported actions. |
| `src/app/dashboard/settings/actions.ts` | `requireRole` on `updateSettingsAction`; `signOutAction` unchanged. |
| `src/app/dashboard/settings/accounts/actions.ts` | Inline role check → `isCurrentUserAdmin()`. |
| `src/app/dashboard/settings/accounts/__tests__/actions.test.ts` | Update assertions for the predicate. |
| New `__tests__/actions.test.ts` per guarded family | Unauthorized-caller tests (one per family). |
| `architecture.md` | Auth sections updated (role resolution, action guards, helper contract). |

### Not affected

- No new HTTP surface, no database/RLS/migration, no new environment variable.
- Middleware matcher and role-only behavior unchanged; feature-only middleware
  enforcement intentionally not added.
- Client portal (`/client/**`, `src/lib/client-auth.ts`), MCP server and its
  tools, `/api/cron/*`, `/api/flight-status`, WhatsApp webhooks.
- Public routes `/t/{slug}` and `/c/{slug}` remain anonymous.

## 5. Risks

- **`trips/[id]` is the largest action family.** Guarding ~46 of its 48 exported
  actions (plus colocated tests) is the biggest single work unit in this change
  and expands the diff materially. *Mitigation:* it stays one reviewable group
  with its own RED/GREEN tasks and per-family tests; `assertTripEditable` is left
  as an orthogonal editability check so it is not confused with authorization.
  *Closing this gap removes the largest residual authorization exposure
  identified in Why.*
- **Feature-level per-action gap.** An authenticated `agent` without the
  `clients` feature could still invoke `createClientAction` if it can reach the
  action endpoint; the role check closes the unauthenticated / no-role hole, not
  the feature hole. *Mitigation:* page-level `requireFeature` still gates the UI;
  per-action feature checks are a documented follow-up.
- **Middleware refactor is an auth-boundary change.** A regression there locks
  everyone out. *Mitigation:* `resolveAccountProfile` is pure and unit-tested;
  `updateSession`'s return shape and `src/middleware.ts` are unchanged; behavior
  (session + role only) is preserved.
- **Throw semantics for actions.** `requireRole`/`requireUser` throw
  `Error("Unauthorized")`, which surfaces at the Server Action error boundary.
  This matches the existing `requireRole` behavior in visas actions; no new UX
  contract is introduced. Actions with typed errors use `isCurrentUserAdmin()`
  instead.
- **Double account fetch.** A page `requireFeature` plus an action `requireRole`
  may resolve the profile twice per request. Acceptable; a request-scoped cache
  is a later optimization.
- **Test coupling.** Action tests mock `@/lib/auth/roles`; each family's
  existing tests must be updated when a guard is added. Existing suites already
  use this mock shape (see `src/app/dashboard/visas/new/__tests__/actions.test.ts`).
- **Stale baseline spec text.** `openspec/specs/account-roles/spec.md` still
  contains mock-mode requirements removed by issue #372 phase 5. This change does
  not rewrite that unrelated drift; it is flagged here so review does not treat
  it as new.

## 6. Open Questions

None blocking. The remaining deferred items (feature-level per-action checks and
request-scoped profile caching) are recorded as follow-ups rather than questions
for this change.
