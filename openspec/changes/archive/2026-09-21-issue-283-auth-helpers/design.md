# Design: Centralizar helpers de autorización server-side (issue #283)

## Technical Approach

Keep the existing helper module and its semantics; finish the adoption and
remove the duplication. Concretely:

1. Extract the pure account-resolution logic out of `src/lib/auth/roles.ts` into
   a Next-API-free module `src/lib/auth/profile.ts`
   (`normalizeRole`, `resolveAccountProfile`).
2. Add three helpers to `src/lib/auth/roles.ts`: `getCurrentUser()`,
   `requireUser()`, and `isCurrentUserAdmin()`.
3. Point `src/lib/supabase/middleware.ts` and `getCurrentAccount()` at the shared
   resolver.
4. Adopt the helpers: dashboard layout identity, every unguarded dashboard
   action family (`requireRole`), and the typed-error accounts action
   (`isCurrentUserAdmin()`).

The middleware stays a role-only navigation gate; pages keep redirect-style
guards; actions and route handlers get throw-style guards. No page behavior
changes.

## Architecture Overview

```text
Server Component / page
  requireFeature(feature) / requireAdmin()        → redirect on denial
        │
Server Action / Route Handler
  requireRole(...allowed) / requireUser()         → throw Error("Unauthorized")
  isCurrentUserAdmin()                            → boolean, typed-error actions
        │
        └──────────────► src/lib/auth/roles.ts ──► src/lib/auth/profile.ts
                                                     normalizeRole()
                                                     resolveAccountProfile(client, userId)
                                                          ▲
src/middleware.ts ──► src/lib/supabase/middleware.ts ─────┘
   (path gate: session + role only; return shape unchanged)
```

`profile.ts` must not import `next/headers` or `next/navigation`, so the
middleware (Edge) can consume it without pulling App Router-only APIs.

## Architecture Decisions

### Decision: Throw vs redirect boundary

**Choice**: `requireRole`, `requireUser`, and `isCurrentUserAdmin()` are the
action/handler API. `requireFeature` and `requireAdmin` stay the page API.
Server Actions and Route Handlers use the throw-style/predicate API only.

**Alternatives**: (a) make actions redirect too, reusing `requireFeature`;
(b) add a generic `authorize()` that returns a result object.

**Rationale**: `requireFeature`/`requireAdmin` call `redirect()` from
`next/navigation`, which emits a `NEXT_REDIRECT` control-flow exception. That is
appropriate for rendering but wrong for mutations and for typed-error actions.
Option (b) is a larger API change with no consumer asking for it. Existing pages
— `src/app/dashboard/clients/page.tsx`, `suppliers/page.tsx`,
`travel-agents/page.tsx`, `settings/page.tsx`, `settings/accounts/page.tsx`,
`visas/page.tsx`, `visas/[id]/page.tsx`, `visas/new/page.tsx`,
`wcc/layout.tsx` — are untouched and keep redirecting.

### Decision: New helper APIs

**Choice**: add to `src/lib/auth/roles.ts`:

- `getCurrentUser(): Promise<User | null>` — identity only (id + email), does not
  touch `profiles`. Used by `src/app/dashboard/layout.tsx` for the profile menu
  email, replacing the inline `supabase.auth.getUser()` at lines 21-24.
- `requireUser(): Promise<User>` — calls `getCurrentUser()` and throws
  `Error("Unauthorized")` when null. The canonical request-identity entry point
  for Server Actions and Route Handlers.
- `isCurrentUserAdmin(): Promise<boolean>` — `(await getCurrentAccount())?.role === "admin"`,
  never throws.

**Alternatives**: a single `requireUser()` returning the full account (rejected:
the layout needs only email and no profile query); an `assertAdmin()` that throws
(rejected: forces try/catch on typed-error actions).

**Rationale**: one identity path, one boolean predicate, no duplicated
`auth.getUser()`.

### Decision: Shared account-resolution module

**Choice**: create `src/lib/auth/profile.ts` exporting `normalizeRole(value)` and
`resolveAccountProfile(client, userId)`. `resolveAccountProfile` performs the
`profiles` select (`id, role, features, travel_agent_id`), normalizes the role,
and applies `filterFeatures` from `src/lib/auth/features.ts`, returning
`AccountProfile | null`. `roles.ts` re-exports `normalizeRole` (public API
unchanged) and `getCurrentAccount()` becomes
`getUser()` → `resolveAccountProfile(client, user.id)`.
`src/lib/supabase/middleware.ts` replaces its inline query (lines 30-43) with
`user ? await resolveAccountProfile(supabase, user.id) : null` and keeps
returning `{ response, user, role }`, so `src/middleware.ts` and its matcher are
untouched.

**Alternatives**: (a) put the resolver in `roles.ts` and import it from
middleware — rejected because `roles.ts` imports `next/headers` (`cookies`) and
`next/navigation` (`redirect`), which the middleware runtime must not pull in;
(b) keep duplicated queries — rejected, it is the defect.

**Client typing**: `resolveAccountProfile` accepts a structural client interface
(`{ from(table: "profiles"): … }`) or the Supabase client types, whichever keeps
`@supabase/ssr`'s `createServerClient` and `@supabase/supabase-js` assignable.
Implementation detail resolved at apply time; the resolver is pure and directly
unit-testable with a fake client (the existing test idiom in
`src/lib/__tests__/roles.test.ts` mocks the client with `from/select/eq/single`
chains).

### Decision: Action guard placement and shape

**Choice**: `await requireRole("admin", "agent");` as the **first** statement of
each mutating action, before any `formData` parsing, validation, or data access.
Import from `@/lib/auth/roles`. One guard per exported action.

**Alternatives**: (a) a decorator/wrapper around `"use server"` exports —
rejected, Next.js requires literal exported functions and a wrapper would hide
the action boundary from type inference and tests; (b) guard in a shared helper
called by the data layer — rejected, the data layer is intentionally
authorization-agnostic.

**Rationale**: explicit, greppable, matches the existing visas-action idiom
(`src/app/dashboard/visas/[id]/actions.ts:33`) and the test idiom that mocks
`@/lib/auth/roles`.

**Families and exact call sites**:

| File | Actions guarded |
|------|-----------------|
| `src/app/dashboard/clients/actions.ts` | `createClientAction`, `deleteClientAction` |
| `src/app/dashboard/clients/[id]/actions.ts` | all 8 exports (`updateClientAction`, `uploadClientDocumentAction`, `deleteClientDocumentAction`, `getClientDocumentsAction`, `uploadClientCoverAction`, `removeClientCoverAction`, `setClientTagsAction`, `updateClientPinAction`) |
| `src/app/dashboard/suppliers/actions.ts` | all 5 exports |
| `src/app/dashboard/travel-agents/actions.ts` | all 3 exports |
| `src/app/dashboard/trips/new/actions.ts` | `createTripAction` |
| `src/app/dashboard/trips/[id]/actions.ts` | all 48 exports; ~46 gain `requireRole("admin", "agent")` as their first statement (the remaining paths already guard through `assertServiceDocumentMutableTrip` and `getServiceChecklistForTripAction`) |
| `src/app/dashboard/actions.ts` | `moveTripStatusAction`, `bulkUpdateTripStatusAction` |
| `src/app/dashboard/wcc/knowledge/actions.ts` | all 3 exports |
| `src/app/dashboard/settings/actions.ts` | `updateSettingsAction` only |

`src/app/dashboard/trips/[id]/actions.ts` is the largest family: it exports 48
actions, and today only `getServiceChecklistForTripAction` (line ~591) and the
`assertServiceDocumentMutableTrip` helper (line ~98, used by the service-document
and checklist actions) call `requireRole`. The rest depend on `assertTripEditable`,
which checks only whether the trip exists and is not published. `assertTripEditable`
MUST stay as an editability concern orthogonal to authorization: the guard is
added before it, so an unauthorized caller is rejected even when the trip would
pass the editability check. Actions already covered indirectly by
`assertServiceDocumentMutableTrip` get the explicit first-statement guard too, so
coverage is uniform and greppable.

`requireRole("admin", "agent")` is used (not `("agent")` alone) because both
roles are valid today and this preserves mono-admin behavior (epic #279). The
allowed-roles parameter is the extension point for future roles: a future
privileged role is added to this list and no call site changes shape.

### Decision: Typed-error action uses the predicate

**Choice**: `src/app/dashboard/settings/accounts/actions.ts` replaces
`const account = await getCurrentAccount(); if (account?.role !== "admin") …`
with `if (!(await isCurrentUserAdmin())) return { ok: false, error: "No autorizado." };`.
The message, the return union, and the write path are unchanged.

**Alternatives**: keep `getCurrentAccount()` (rejected: exposes account internals
the action does not need); throw (rejected: the action's contract is a
discriminated union, and the UI renders an inline error rather than an error
boundary).

### Decision: Sign-out stays unguarded

**Choice**: `signOutAction` in `src/app/dashboard/settings/actions.ts` keeps its
current body (`createClient()` → `auth.signOut()` → redirect) with no role check,
and is called out in the spec as an explicit exemption.

**Rationale**: a user whose profile is missing or role-less must still be able to
sign out; adding a guard would trap the session.

### Decision: Documentation freshness

**Choice**: update the auth sections of `architecture.md` (role-resolution
paragraph around the `Multi-cuenta y roles` section, the `src/lib/auth/roles.ts`
bullet, and the middleware bullet): the helper list gains
`getCurrentUser`/`requireUser`/`isCurrentUserAdmin`, the shared
`src/lib/auth/profile.ts` resolver, and the throw-vs-redirect enforcement
contract. Per the README truth-source table, `Changes.md` is not touched because
there is no user-visible behavior change; `project.md`, `PRODUCT.md`,
`DESIGN.md`, and `doc/*` are unaffected.

## Data Flow (per request)

1. **Navigation**: `src/middleware.ts` → `updateSession()` → `getUser()` →
   `resolveAccountProfile(client, user.id)` → role gate. Unchanged shape;
   only the profile query is now shared.
2. **Page render**: page calls `requireFeature(feature)` / `requireAdmin()` →
   `getCurrentAccount()` → `resolveAccountProfile`. Redirect on denial.
3. **Mutation**: Server Action → `requireRole("admin","agent")` (or
   `requireUser()`) → throw `Error("Unauthorized")` on denial → data access via
   `src/lib/data.ts`.
4. **Typed-error mutation**: accounts action → `isCurrentUserAdmin()` → return
   `{ ok: false, error: "No autorizado." }` instead of throwing.

## Interfaces / Contracts

```ts
// src/lib/auth/profile.ts (new)
export function normalizeRole(value: unknown): AccountRole | null;
export async function resolveAccountProfile(
  client: ProfileClient,
  userId: string,
): Promise<AccountProfile | null>;

// src/lib/auth/roles.ts (additions; normalizeRole re-exported)
import type { User } from "@supabase/supabase-js";

export function getCurrentUser(): Promise<User | null>;
export function requireUser(): Promise<User>;            // throws Error("Unauthorized")
export async function isCurrentUserAdmin(): Promise<boolean>; // never throws
export { normalizeRole } from "./profile";
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/auth/profile.ts` | Create | Pure `normalizeRole` + `resolveAccountProfile`; no `next/*` imports. |
| `src/lib/auth/roles.ts` | Modify | Add `getCurrentUser`/`requireUser`/`isCurrentUserAdmin`; delegate to `profile.ts`; re-export `normalizeRole`. |
| `src/lib/supabase/middleware.ts` | Modify | Replace inline profile query with `resolveAccountProfile`; return shape unchanged. |
| `src/middleware.ts` | No change | Matcher and role-only behavior preserved. |
| `src/app/dashboard/layout.tsx` | Modify | Inline `auth.getUser()` → `getCurrentUser()` for profile-menu email. |
| `src/app/login/actions.ts` | No change | Authentication boundary; credential exchange only (`signInWithPassword`), no `getUser()`. |
| `src/app/dashboard/clients/actions.ts` | Modify | `requireRole` on 2 actions. |
| `src/app/dashboard/clients/[id]/actions.ts` | Modify | `requireRole` on 8 actions. |
| `src/app/dashboard/suppliers/actions.ts` | Modify | `requireRole` on 5 actions. |
| `src/app/dashboard/travel-agents/actions.ts` | Modify | `requireRole` on 3 actions. |
| `src/app/dashboard/trips/new/actions.ts` | Modify | `requireRole` on `createTripAction`. |
| `src/app/dashboard/trips/[id]/actions.ts` | Modify | `requireRole` as first statement on the ~46 exports that lack an explicit guard; `assertTripEditable` unchanged (editability only). |
| `src/app/dashboard/actions.ts` | Modify | `requireRole` on 2 status actions. |
| `src/app/dashboard/wcc/knowledge/actions.ts` | Modify | `requireRole` on 3 actions. |
| `src/app/dashboard/settings/actions.ts` | Modify | `requireRole` on `updateSettingsAction`; `signOutAction` unchanged. |
| `src/app/dashboard/settings/accounts/actions.ts` | Modify | Inline check → `isCurrentUserAdmin()`. |
| `src/lib/__tests__/roles.test.ts` | Modify | Tests for `getCurrentUser`/`requireUser`/`isCurrentUserAdmin`. |
| `src/lib/__tests__/profile.test.ts` | Create | Pure resolver matrix. |
| `src/lib/__tests__/supabase-middleware.test.ts` | Modify | Middleware uses shared resolver. |
| `src/app/dashboard/__tests__/layout.test.tsx` | Modify | Mock `getCurrentUser`. |
| `src/app/dashboard/settings/accounts/__tests__/actions.test.ts` | Modify | Predicate assertions. |
| new `__tests__/actions.test.ts` per guarded family | Create | Unauthorized-caller coverage. |
| `architecture.md` | Modify | Auth sections updated. |

No changes to: `src/types/index.ts`, `src/lib/data.ts`, Supabase migrations/RLS,
`src/middleware.ts`, `src/lib/client-auth.ts`, `src/lib/mcp/**`, `/api/*`.

## Testing & Verification Plan

The project has Vitest (`npm test` → `vitest run`) and colocated
`__tests__/*.test.ts` with `@` → `src`. Strict TDD is enabled in
`openspec/config.yaml`. Auth unit tests mock `@/lib/supabase/server`; action
tests mock `@/lib/auth/roles` (see
`src/app/dashboard/visas/new/__tests__/actions.test.ts`).

| Layer | What to test | Approach |
|-------|--------------|----------|
| Unit | `normalizeRole` unknown/known; `resolveAccountProfile` maps `travel_agent_id`, filters unknown features, returns `null` on missing row/role | `src/lib/__tests__/profile.test.ts` with a fake client chain (`from/select/eq/single`). |
| Unit | `getCurrentUser` null/return; `requireUser` throws `Error("Unauthorized")`; `isCurrentUserAdmin` false for agent/missing and true for admin | `src/lib/__tests__/roles.test.ts`, mocking `@/lib/supabase/server` as today. |
| Unit | Middleware resolves role through the shared resolver and keeps `{ response, user, role }` shape | Extend `src/lib/__tests__/supabase-middleware.test.ts`. |
| Unit | Layout renders the profile email via `getCurrentUser` | Extend `src/app/dashboard/__tests__/layout.test.tsx` mock. |
| Unit | Accounts action: non-admin → exact `{ ok: false, error: "No autorizado." }` and no write; admin → write + `{ ok: true }`; predicate never throws | `src/app/dashboard/settings/accounts/__tests__/actions.test.ts`. |
| Unit | Each guarded family: unauthorized caller → `requireRole` rejects (throws) and the data function is not called; valid role → action runs | New `__tests__/actions.test.ts` per family, mocking `@/lib/auth/roles` + `@/lib/data`. |
| Unit | Trip detail family: representative unauthorized callers throw and mutate nothing, including an editable (non-published) trip where `assertTripEditable` would pass; the already-guarded edge actions (`assertServiceDocumentMutableTrip`, `getServiceChecklistForTripAction`) keep rejecting without a role | Extend `src/app/dashboard/trips/[id]/__tests__/actions.test.ts` (already mocks `@/lib/auth/roles`). |
| Type | `npx tsc --noEmit` clean | CI gate. |
| Build | `npm run build` clean | CI gate; confirms no client bundle imports a server-only helper. |

Manual fallback: with no Supabase env, the mocked unit suites plus
`tsc`/`build` are the verification of record; live middleware behavior is not
exercised locally.

## Threat Matrix

| Boundary | Applicable | Control |
|----------|------------|---------|
| Authorization boundary (this change) | Yes | Throw-style guards inside every mutating dashboard action; middleware demoted to navigation gate; role resolution shared so gate and guards cannot disagree. |
| Routing / shell / subprocess / VCS / PR / executable-file / process-integration | No | No new routing, shell, subprocess, VCS, PR, executable, or process integration surface is introduced. |

## Migration / Rollout

No data migration, no schema change, no new environment variable, no flag. The
change is a server-side refactor: deploy is the normal push to `main`. Rollback
is a revert of the touched TS files; the middleware is the only auth-boundary
file and its external contract (`updateSession` return shape, matcher) is
unchanged.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| `trips/[id]` is the largest family (~48 exports) | One reviewable group with its own RED/GREEN tasks and an extended test file; `requireRole` becomes the first statement on the ~46 unguarded exports and `assertTripEditable` stays editability-only. |
| Feature-level per-action gap (role check ≠ feature check) | Page `requireFeature` still gates UI; per-action feature enforcement deferred and documented. |
| Middleware regression locks users out | Resolver is pure + unit-tested; `updateSession` shape and `src/middleware.ts` untouched; behavior (session + role) preserved. |
| Throw in an action surfaces at the error boundary | Same contract as existing `requireRole` in visas actions; typed-error actions use `isCurrentUserAdmin()` instead. |
| Double profile fetch per request | Accepted; request-scoped caching is a later optimization. |
| Test drift from new guards | Each family's tests are updated in the same work unit; existing mock idiom reused. |
| Baseline `account-roles` mock-mode text is stale (#372 phase 5) | Out of scope; flagged so it is not attributed to this change. |
