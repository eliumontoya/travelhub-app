# Proposal: Per-agent feature system in the dashboard (issue #304)

## Intent

Replace the binary `admin` vs `agent` split with a fully configurable, per-agent feature model. Today the dashboard nav gates a handful of links behind `isAdmin`, and direct-URL access to those routes is not blocked at all. The `profiles` table, `canAccessFeature()`, and mock parity already exist from issue #300 — but nothing actually **consumes** the `features[]` array. This change wires feature gating through the nav, adds route-level enforcement, and adds an admin UI + write path so an admin can assign features per agent without touching SQL.

## Scope

### In Scope

- A typed `Feature` union and an `AVAILABLE_FEATURES` constant defining the 6 base features: `trips`, `clients`, `suppliers`, `travel-agents`, `whatsapp`, `settings`.
- Nav gating in `src/app/dashboard/layout.tsx`: switch from `getCurrentUserRole` + `isAdmin` to `getCurrentAccount` + `canAccessFeature`, one feature per link. Dashboard home (`/dashboard`) stays unconditional.
- Route-level (server-side) feature guards so a direct request to a gated route is blocked (redirected), not just hidden. Applies to all 6 feature routes: trips, clients, suppliers, travel-agents, wcc (whatsapp), settings.
- Admin management UI: an admin-only view to list account profiles and assign/toggle per-agent `features`.
- A `profiles` write path: data-layer `listProfiles` / `updateProfileFeatures` (dual-mode: Supabase + mock), plus a Supabase migration granting an admin-only `UPDATE` policy on `profiles`.
- Tests for `canAccessFeature` combinations, `AVAILABLE_FEATURES`, the new guard helper, the write path, and nav/route gating.
- Supabase **and** mock-mode parity throughout (both read and write paths).

### Out of Scope

- Per-agent feature gating of *data* (row-level filtering of trips/clients by owning agent). Feature gating is about which *sections* an agent can reach, not which records within a section they see.
- Changing the `admin`/`agent` role enumeration or the `profiles` schema shape beyond adding a write policy.
- Self-service provisioning (an agent granting themselves features).
- CommandPalette search scoping — flagged as a follow-up risk (see Risks); the palette currently loads all clients/trips regardless of role. We are **not** changing the palette's data load in this change unless the design phase chooses to, and will call out any leak explicitly if deferred.
- A fully-featured account-management CRUD (create/delete auth users); only the existing profiles' `features` are mutable.

## Capabilities

> This section is the CONTRACT between proposal and specs phases. The sdd-spec agent reads this to know exactly which spec files to create or update.

### New Capabilities

- `agent-feature-management`: Admin-facing management of per-agent feature assignments. Covers listing account profiles, viewing their current `features`, and updating them via an admin-only write path (Supabase `UPDATE` policy on `profiles` + mock parity). This is the admin UI + write path that does not exist today.

### Modified Capabilities

- `account-roles`: The feature model and its enforcement. Adds the `Feature` type and `AVAILABLE_FEATURES` constant; tightens `AccountProfile.features` to a typed list; extends `canAccessFeature` and adds a route-level `requireFeature` guard; and replaces the previous "deny **or** hide" language with strict enforcement (admins see everything; agents see/access only assigned features; nothing is implicitly always-on for agents). Mock-mode feature parity is already specified here and is extended to cover the new constant and guard.
- `dashboard-workspace`: The dashboard shell's nav-link visibility. Adds the requirement that each feature nav link (`Viajes`, `Clientes`, `Proveedores`, `Agentes`, `WhatsApp C.C.`, `Ajustes`) is rendered only when the current account can access its feature, with the Dashboard home link unconditional.

## Approach

**Feature model** (in `src/lib/auth/roles.ts`, home of `canAccessFeature`):
- Add `export type Feature = "trips" | "clients" | "suppliers" | "travel-agents" | "whatsapp" | "settings";` in `src/types/index.ts`, and change `AccountProfile.features` from `string[]` to `Feature[]`.
- Add `export const AVAILABLE_FEATURES: Feature[] = [...]` in `roles.ts` (or a sibling `features.ts`) with an explicit order + label map (`{ feature, href, label }`) reused by the layout so the nav and the admin UI share one source of truth.
- Tighten `canAccessFeature(profile, feature: Feature)`; in `getCurrentAccount`, defensively filter the Supabase `text[]` to recognized `Feature` values so unknown DB strings silently drop instead of leaking through.

**Nav gating** (`src/app/dashboard/layout.tsx`):
- Replace `getCurrentUserRole(mockAccountId)` / `isAdmin` with `getCurrentAccount(mockAccountId)`, then render each link guarded by `canAccessFeature(account, "<feature>")`. Keep the Dashboard home link unconditional.

**Route-level enforcement** (server-side, App Router):
- Add a `requireFeature(feature: Feature)` helper in `roles.ts` that resolves the current account and returns it if the feature is accessible (admin always; agent only when assigned), otherwise signals denial.
- In each gated page (`trips`, `clients`, `suppliers`, `travel-agents`, `wcc`, `settings`) call the guard and `redirect()` an unauthorized agent (target: `/dashboard`, or an explicit "no access" state — design detail). Mock mode uses the same `getCurrentAccount` path, so enforcement matches Supabase.
- Route enforcement is done at the page/server-component layer, **not** in `src/middleware.ts`. Middleware keeps its existing role-only check; it does not load per-account features (avoids breaking mock parity and edge-runtime data access).

**Admin management UI + write path** (new `agent-feature-management` capability):
- New `src/lib/data/profiles.ts` (re-exported from `src/lib/data.ts`): `listProfiles()` (admin-only read of all profiles) and `updateProfileFeatures(id, features: Feature[])` (admin-only write), dual-mode like `travel-agents.ts` — Supabase `.update({ features }).eq("id", id)` vs. mutating `mockProfiles`.
- New migration `supabase/migrations/<ts>_profiles_admin_update.sql`: an admin-only `UPDATE` policy on `profiles` (mirroring the existing `profiles_admin_read_all`), and `grant update(features) on profiles to authenticated` (or equivalent scoped grant) so the admin write path works under RLS. Leave self-read/admin-read policies untouched.
- Admin UI: an admin-only section (placement decided in design — either extended into the `/dashboard/travel-agents` catalog or a dedicated accounts/features view) that lists profiles with per-feature toggles, calling `listProfiles`/`updateProfileFeatures`. The `travel-agents` feature gate still governs the catalog; feature management itself is admin-gated.

**Mock parity & tests:**
- Update `mockProfiles["mock-agent"].features` to a realistic set (the model is fully configurable, so `mock-agent` keeps `["trips"]` or a richer demo set — decided in design) so tests demonstrate both granted and denied features.
- Extend `src/lib/__tests__/roles.test.ts` for `Feature`/`AVAILABLE_FEATURES`/`canAccessFeature` combinations and the `requireFeature` guard; add tests for `listProfiles`/`updateProfileFeatures` (mock + Supabase) and for nav gating. Strict TDD: `npm run test` before implementation, RED → GREEN → REFACTOR.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/types/index.ts` | Modified | Add `Feature` union; change `AccountProfile.features` to `Feature[]`. |
| `src/lib/auth/roles.ts` | Modified | Add `AVAILABLE_FEATURES` + label/route map; tighten `canAccessFeature`; add `requireFeature`; filter unknown features in `getCurrentAccount`. |
| `src/app/dashboard/layout.tsx` | Modified | Switch to `getCurrentAccount` + `canAccessFeature`; gate each nav link per feature. |
| `src/app/dashboard/{trips,clients,suppliers,travel-agents,wcc,settings}/page.tsx` | Modified | Add server-side `requireFeature` guard + redirect. |
| `src/lib/data/profiles.ts` | New | `listProfiles`, `updateProfileFeatures` (dual-mode). |
| `src/lib/data.ts` | Modified | Re-export `./profiles`. |
| `src/lib/mock-data.ts` | Modified | Update `mock-agent` features; possibly make `mockProfiles` mutable for the write path. |
| `supabase/migrations/<ts>_profiles_admin_update.sql` | New | Admin-only `UPDATE` policy on `profiles` + scoped grant. |
| `src/lib/__tests__/roles.test.ts` | Modified | Extend for `Feature`, `AVAILABLE_FEATURES`, `requireFeature`, gating combos. |
| `src/lib/__tests__/` (new profiles/data test) | New | Test `listProfiles` / `updateProfileFeatures` (mock + Supabase). |
| Admin UI (`travel-agents` catalog or new accounts view) | New | Feature-toggle UI for admins. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **Behavior change for existing agents**: strict gating hides `Clientes`/`Proveedores`/etc. from agents who previously saw the unconditional base nav. | Med | Fully-configurable model is the resolved product decision; `mock-agent` and any seeded agents get a clear default set; document the change in the migration/proposal and update acceptance tests. |
| **Direct-URL bypass** if guards are missed on any gated route. | Med | A single `requireFeature` helper applied to all 6 gated pages; a test asserts each gated route redirects an unassigned agent. |
| **CommandPalette leakage**: the palette still loads all clients/trips regardless of features. | Low/Med | Explicitly out of scope this change; flag in the changelog/acceptance notes as a known follow-up so it is a conscious deferral, not an oversight. |
| **RLS write policy regression**: adding an admin `UPDATE` policy could be scoped too broadly. | Low | Scope the grant to `features` (and `updated_at`) only, admin-only, mirroring the existing `profiles_admin_read_all` guard; test the migration. |
| **Untyped `text[]` in DB** allows unknown strings; typing `features: Feature[]` could mismatch. | Low | Defensive filter in `getCurrentAccount` drops unknown values; `AVAILABLE_FEATURES` is the single source of truth. |

## Rollback Plan

The change is additive at the schema level and behaviorally reversible at the code level:

- **Schema (Supabase)**: the new migration only *adds* an admin-only `UPDATE` policy + scoped grant; it does not drop or alter existing policies, columns, or data. To roll back, revert the migration and re-run `supabase db reset` (or manually `drop policy` / `revoke update(features)`); existing `profiles` rows are unaffected because the change never writes to them unless an admin edits features.
- **Code**: nav/route gating and the write path are independent of the schema. Revert to the prior `layout.tsx` (`getCurrentUserRole` + `isAdmin`) and remove the `requireFeature` guards to restore the pre-change behavior. No data migration is required — `features` already exists and defaults to `'{}'`.
- **Rollback trigger**: if an agent can reach a gated route they should not (guard failure), or if the admin write path breaks RLS (agent can self-elevate), revert the migration + guard changes and restore manual provisioning.
- The change can be deployed behind the existing mock/Supabase dual-mode toggle with no destructive step; each commit is independently revertible.

## Dependencies

- Issue #300 artifacts already merged: `profiles` table + migration `20260916170000_account_profiles.sql`, `canAccessFeature`/`getCurrentAccount` in `roles.ts`, `mockProfiles`, `AccountProfile` type.
- A Supabase environment for exercising the write policy end-to-end; mock mode covers local development.

## Success Criteria

- [ ] Admins still see every nav link and can reach every dashboard route (no regression).
- [ ] An agent sees and can reach only their assigned features; direct-URL navigation to an unassigned feature route is blocked (redirected).
- [ ] `AVAILABLE_FEATURES` defines exactly the 6 features, and `canAccessFeature` honors it (admin → true for all; agent → only assigned; null profile → false).
- [ ] An admin can list profiles and assign/update an agent's `features` through the UI, persisted via the Supabase write path and mirrored in mock mode.
- [ ] `npm run test` passes with coverage for `canAccessFeature` combinations, the route guard, and the profiles write path (mock + Supabase).
- [ ] `npm run build` and `npx tsc --noEmit` pass; behavior is identical in Supabase and mock mode.
