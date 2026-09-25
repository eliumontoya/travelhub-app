# Design: Per-agent feature system in the dashboard (issue #304)

## Technical Approach

Replace the binary `admin` vs `agent` split in the dashboard with a configurable, per-account feature model. A single typed `Feature` union and an ordered `AVAILABLE_FEATURES` catalog become the source of truth consumed by three surfaces: the dashboard nav (visibility), the six gated routes (server-side enforcement), and a new admin-only feature-management view (assignment).

The existing building blocks from issue #300 already exist and are reused, not replaced:

- `profiles` table + `AccountProfile` type + `canAccessFeature()` + `getCurrentAccount()`.
- The dual-mode data layer (`src/lib/data/*`) and mock parity (`mockProfiles`).

What is missing today, and what this change adds, is **consumption and enforcement**: nothing currently reads the `features[]` array. We add (1) a typed catalog + feature→(href,label) map, (2) nav gating per feature, (3) a server-side `requireFeature` guard applied to every gated route, and (4) an admin write path (`listProfiles` / `updateProfileFeatures`) backed by a Supabase `UPDATE` policy and an in-memory mock mirror.

**Critical discovered constraint (drives the migration design):** the original `profiles_admin_read_all` policy from `20260916170000_account_profiles.sql` was **dropped** in `20260917100000_fix_profiles_rls_recursion.sql` because its self-join `select … from profiles … where role = 'admin'` caused `infinite recursion detected in policy` (the inner select is itself RLS-subject, and `profiles` has `force row level security`). Therefore `listProfiles()` (admin read-all) has **no working RLS path today**, and any new admin read/update policy must **not** re-introduce the recursion. The new migration introduces a `SECURITY DEFINER` helper function with `row_security = off` to resolve "is the caller an admin" without a recursive policy subquery.

## Architecture Decisions

### Decision: Single feature catalog lives in a dependency-free module (`features.ts`)

**Choice**: Create `src/lib/auth/features.ts` exporting `AVAILABLE_FEATURES`, `FEATURE_DEFINITIONS` (`{ feature, href, label }[]`), `isFeature`, and `filterFeatures`. `roles.ts` imports from it; the nav and the admin toggle UI import from it too.

**Alternatives considered**:
- Put the catalog + label/href map directly in `roles.ts`. Rejected: `roles.ts` imports `@/lib/supabase/server` (which uses `next/headers` cookies) and `@/lib/mock-data`; importing it from the admin feature-toggle **client component** would pull server-only modules into a client bundle.
- Duplicate the feature list in the nav and admin UI. Rejected: violates "single source of truth" (the proposal's explicit requirement) and allows the nav and admin UI to drift.

**Rationale**: `features.ts` has zero server-only imports (only `@/types`), so it is safe to import from both Server Components (`layout.tsx`, `page.tsx`) and Client Components (the toggle UI). The `href` field is what lets the `whatsapp` feature map to the `/dashboard/wcc` route and `travel-agents` to `/dashboard/travel-agents` without hard-coding route strings in consumers.

### Decision: `requireFeature` returns the account and `redirect()`s on denial

**Choice**: `requireFeature(feature, mockAccountId?)` resolves the account through `getCurrentAccount`, and if `canAccessFeature` is false it calls `redirect("/dashboard")`; on success it returns the resolved `AccountProfile`.

**Alternatives considered**:
- Return a boolean/null and let each of the 6 pages call `redirect()` itself. Rejected: six duplicated `if (!…) redirect()` blocks; the denial logic belongs in one place.
- Throw `Error("Unauthorized")` like the existing `requireRole`. Rejected: `requireRole` is used inside server actions where a thrown error is acceptable; a page-level guard needs a redirect, not an error boundary.

**Rationale**: One helper, applied identically to all six routes, is the mitigation for the "direct-URL bypass" risk (a single test can assert the redirect target and that all six pages call it). The pure decision (`canAccessFeature`) stays separately unit-testable, and the redirect is mockable via `next/navigation` in tests.

### Decision: Route enforcement lives in pages/layouts, NOT middleware

**Choice**: Add `requireFeature` calls to the six gated Server Components. `src/middleware.ts` is unchanged and keeps its role-only check.

**Alternatives considered**:
- Load per-account features in `middleware.ts`. Rejected by the proposal and by the codebase reality: middleware runs on the edge runtime where `next/headers` cookies and the dual-mode `getCurrentAccount` path are not available; and the middleware currently reads only `role` from `profiles` (see `src/lib/supabase/middleware.ts`), so features are not in its data flow.

**Rationale**: This matches the existing App Router convention (data/guards run in Server Components) and preserves mock parity — the guard uses the exact same `getCurrentAccount` path as the nav.

### Decision: WhatsApp feature guard is placed in `wcc/layout.tsx`, not `page.tsx`

**Choice**: Guard the `whatsapp` feature in `src/app/dashboard/wcc/layout.tsx` (a Server Component), which wraps `/dashboard/wcc` and all its sub-routes (`contacts`, `conversations`, `escalations`, `knowledge`).

**Alternatives considered**: Guard only `wcc/page.tsx`. Rejected: a direct request to `/dashboard/wcc/contacts` (or any sub-route) would bypass a page-only guard.

**Rationale**: The `wcc` area is a multi-route section with its own `layout.tsx`; the nested layout is the single choke point for all of its children. The other five features are single `page.tsx` routes and are guarded in their `page.tsx`.

### Decision: Admin UI is a dedicated view at `/dashboard/settings/accounts`

**Choice**: A new admin-only route `src/app/dashboard/settings/accounts/page.tsx` guarded by `requireAdmin()`, with a client toggle component and a server action. It is reached via an admin-only nav link in the dashboard header.

**Alternatives considered**:
- Extend the `/dashboard/travel-agents` catalog. Rejected: `travel_agents` (name/email/phone/notes, assignable to trips) and `profiles` (auth accounts with role + features) are **two different domain entities and two different tables**. The catalog is already a CRUD table with its own dialogs and actions; mixing a `profiles` table into it conflates the two data layers, and the `travel-agents` feature is assignable to agents (so an agent with `travel-agents` would need the profiles section hidden from them — reintroducing a hidden admin sub-section inside a feature page).
- A new top-level `/dashboard/accounts` route. Rejected: adds a new top-level route directory for a single admin view; nesting under `settings` (workspace configuration) is the natural home and keeps the route tree tidy.

**Rationale**: Feature management is a configuration/admin concern, so it nests under `settings`. It is **not** gated by the `settings` feature (that feature can be assigned to agents); it has its own `requireAdmin()` guard, so the admin-only boundary is independent of feature assignment. The nav entry is an admin-only link (rendered when `role === "admin"`), which is outside the six-feature catalog — account management is the tool that edits the flags, not a flag itself.

### Decision: Unauthorized redirect target is `/dashboard`

**Choice**: `requireFeature` (and `requireAdmin`) redirect to `/dashboard`, the unconditional home.

**Alternatives considered**:
- An explicit "no access" page/state. Rejected: adds a new route and error surface for marginal benefit; harder to test; and the denial is transient (an agent clicking a stale link), not a state worth a dedicated screen.
- Redirect to `/login`. Rejected: the user is already authenticated; bouncing to login is wrong and would confuse (and the middleware already handles unauthenticated redirects).

**Rationale**: `/dashboard` is rendered unconditionally for every authenticated role, so the redirect can never loop. A `?denied=<feature>` query-param flash can be layered on later using the existing `src/lib/dashboard-flash.ts` pattern, but is deliberately **out of scope** for this change to keep the guard deterministic and the test surface small.

### Decision: `mock-agent` default features are `["trips", "clients"]`

**Choice**: Set `mockProfiles["mock-agent"].features` to `["trips", "clients"]`.

**Alternatives considered**:
- Keep `["trips"]`. Rejected: exercises only one granted feature and five denied; too thin to demonstrate the model.
- A richer admin-like set (e.g. including `whatsapp` or `settings`). Rejected: unrealistic for a field agent and would not leave enough denied features to test denial meaningfully.

**Rationale**: Two granted (`trips`→Viajes, `clients`→Clientes) and four denied (`suppliers`, `travel-agents`, `whatsapp`, `settings`) features exercise both the "show/allow" and "hide/redirect" paths across nav gating, route guards, and the admin UI (which will render `mock-agent` with two checked boxes). It is also realistic: an agent manages trips and their clients but not suppliers/catalog/WhatsApp/workspace settings.

## Data Flow

### Read / guard flow (nav + route enforcement)

```
GET /dashboard/settings          GET /dashboard (nav)
        │                                │
        ▼                                ▼
 requireFeature("settings")      layout.tsx:
        │                        getCurrentAccount(mockAccountId)
        ▼                                │
 getCurrentAccount()                     ▼
        │                        canAccessFeature(account, "<feature>")
        ├─ mock: mockProfiles[id]        │
        │    → filterFeatures(features)  ├─ admin → render all links
        └─ supabase: profiles            └─ agent → render only assigned
             (self-read RLS)                 links (home always)
        │
        ▼
 canAccessFeature(account, feature)
        ├─ null profile  → false → redirect("/dashboard")
        ├─ admin         → true  → render page
        └─ agent         → features.includes(feature)
                              ├─ true  → render page
                              └─ false → redirect("/dashboard")
```

### Write flow (feature assignment)

```
Admin toggles feature in FeatureManagerClient (client)
        │
        ▼
 updateProfileFeaturesAction(profileId, features)   "use server"
        │
        ├─ getCurrentAccount() → role !== "admin" → { ok:false, error }
        ▼
 updateProfileFeatures(id, features)          (src/lib/data/profiles.ts)
        │
        ├─ filterFeatures(features)           (drop unknown strings)
        ├─ mock:    mockProfiles[id].features = sanitized   (in-memory)
        └─ supabase: profiles.update({ features, updated_at }).eq("id")
                      │
                      ▼
              RLS: profiles_admin_update_features
                   → is_admin_account()  (SECURITY DEFINER, row_security=off)
        │
        ▼
 revalidatePath("/dashboard/settings/accounts")
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/types/index.ts` | Modify | Add `export type Feature = "trips" \| "clients" \| "suppliers" \| "travel-agents" \| "whatsapp" \| "settings";` and change `AccountProfile.features` from `string[]` to `Feature[]`. |
| `src/lib/auth/features.ts` | **Create** | Dependency-free feature catalog: `AVAILABLE_FEATURES: Feature[]`, `FEATURE_DEFINITIONS: readonly { feature; href; label }[]`, `isFeature(value): value is Feature`, `filterFeatures(values: unknown): Feature[]`. Single source of truth for nav + guards + admin UI. |
| `src/lib/auth/roles.ts` | Modify | Tighten `canAccessFeature(profile, feature: Feature)`; add `requireFeature(feature, mockAccountId?)` and `requireAdmin(mockAccountId?)` (both `redirect("/dashboard")` on denial); add `resolveMockAccountId(mockAccountId?)` (reads the `x-mock-account-id` cookie); apply `filterFeatures` defensively in **both** mock and Supabase branches of `getCurrentAccount`. |
| `src/lib/data/profiles.ts` | **Create** | `rowToProfile`, `listProfiles()` (admin read-all, dual-mode), `updateProfileFeatures(id, features: Feature[])` (dual-mode). Mirrors `travel-agents.ts` conventions. |
| `src/lib/data.ts` | Modify | Add `export * from "@/lib/data/profiles";`. |
| `src/lib/mock-data.ts` | Modify | Change `mockProfiles["mock-agent"].features` to `["trips", "clients"]`. (`mockProfiles` is already a mutable `Record<string, AccountProfile>` — no structural change needed for the write path.) |
| `src/app/dashboard/layout.tsx` | Modify | Replace `getCurrentUserRole`+`isAdmin` with `getCurrentAccount(mockAccountId)`; render each feature link from `FEATURE_DEFINITIONS` guarded by `canAccessFeature(account, def.feature)`; keep Dashboard home unconditional; add admin-only "Cuentas" link to `/dashboard/settings/accounts`. |
| `src/app/dashboard/trips/page.tsx` | Modify | Add `await requireFeature("trips");` before data load. |
| `src/app/dashboard/clients/page.tsx` | Modify | Add `await requireFeature("clients");` before data load. |
| `src/app/dashboard/suppliers/page.tsx` | Modify | Add `await requireFeature("suppliers");` before data load. |
| `src/app/dashboard/travel-agents/page.tsx` | Modify | Add `await requireFeature("travel-agents");` before data load. |
| `src/app/dashboard/wcc/layout.tsx` | Modify | Add `await requireFeature("whatsapp");` (guards the section and all sub-routes). |
| `src/app/dashboard/settings/page.tsx` | Modify | Add `await requireFeature("settings");` before data load. |
| `src/app/dashboard/settings/accounts/page.tsx` | **Create** | Admin-only server page: `await requireAdmin()` then `listProfiles()`, render `FeatureManagerClient`. |
| `src/app/dashboard/settings/accounts/actions.ts` | **Create** | `updateProfileFeaturesAction(profileId, features)` server action: re-verify admin, call `updateProfileFeatures`, `revalidatePath("/dashboard/settings/accounts")`. |
| `src/app/dashboard/settings/accounts/FeatureManagerClient.tsx` | **Create** | `"use client"` toggle UI: lists profiles with per-feature checkboxes from `FEATURE_DEFINITIONS`; calls `updateProfileFeaturesAction`. |
| `supabase/migrations/20260924000000_profiles_admin_update.sql` | **Create** | `is_admin_account()` SECURITY DEFINER function; `profiles_admin_read_all` SELECT policy; `profiles_admin_update_features` UPDATE policy; scoped `grant update(features, updated_at) on profiles to authenticated`. |
| `src/lib/__tests__/features.test.ts` | **Create** | Catalog shape: exactly six features in order; `isFeature`; `filterFeatures` drops unknown / preserves recognized; `FEATURE_DEFINITIONS` href/label map (incl. `whatsapp→/dashboard/wcc`). |
| `src/lib/__tests__/roles.test.ts` | Modify | Extend `canAccessFeature` (typed Feature matrix), defensive filtering in `getCurrentAccount` (mock + Supabase), `requireFeature` (admin pass / agent-with-feature pass / agent-without redirect / null redirect), `requireAdmin`. |
| `src/lib/__tests__/profiles.test.ts` | **Create** | `listProfiles` (mock + Supabase mapping), `updateProfileFeatures` (mock in-memory mutation + subsequent read reflects; Supabase `.update().eq().select().single()`; unknown feature not persisted). |
| `src/lib/__tests__/profiles-admin-update-migration.test.ts` | **Create** | Asserts the new migration SQL shape (SECURITY DEFINER helper, admin read-all + update policies, scoped column grant, no broad `grant update`). |

> `src/middleware.ts` and `src/lib/supabase/middleware.ts` are intentionally **unchanged**: middleware keeps its role-only check and does not load per-account features (edge runtime + mock-parity constraints).

## Interfaces / Contracts

### `src/types/index.ts`

```ts
export type Feature =
  | "trips"
  | "clients"
  | "suppliers"
  | "travel-agents"
  | "whatsapp"
  | "settings";

export interface AccountProfile {
  id: string;
  role: AccountRole;          // "admin" | "agent" (unchanged)
  features: Feature[];        // was string[]
  travelAgentId?: string;
}
```

### `src/lib/auth/features.ts`

```ts
import type { Feature } from "@/types";

export const AVAILABLE_FEATURES: Feature[] = [
  "trips", "clients", "suppliers", "travel-agents", "whatsapp", "settings",
];

export interface FeatureDefinition {
  feature: Feature;
  href: string;   // actual App Router path
  label: string;  // Spanish UI label
}

export const FEATURE_DEFINITIONS: readonly FeatureDefinition[] = [
  { feature: "trips",         href: "/dashboard/trips",         label: "Viajes" },
  { feature: "clients",       href: "/dashboard/clients",       label: "Clientes" },
  { feature: "suppliers",     href: "/dashboard/suppliers",     label: "Proveedores" },
  { feature: "travel-agents", href: "/dashboard/travel-agents", label: "Agentes" },
  { feature: "whatsapp",      href: "/dashboard/wcc",           label: "WhatsApp C.C." },
  { feature: "settings",      href: "/dashboard/settings",      label: "Ajustes" },
];

export function isFeature(value: unknown): value is Feature;
export function filterFeatures(values: unknown): Feature[];  // Array.isArray guard + isFeature filter
```

### `src/lib/auth/roles.ts` (additions)

```ts
import { redirect } from "next/navigation";
import type { Feature } from "@/types";
import { filterFeatures } from "@/lib/auth/features";

export const MOCK_ACCOUNT_COOKIE = "x-mock-account-id";

// Reads the dev/test cookie override when no explicit id is supplied.
export async function resolveMockAccountId(mockAccountId?: string): Promise<string | undefined>;

// Tightened: feature is now a typed Feature.
export function canAccessFeature(profile: AccountProfile | null, feature: Feature): boolean;

// Returns the account; redirect("/dashboard") on denial (null profile, or
// agent without the feature). Admin always passes.
export async function requireFeature(
  feature: Feature,
  mockAccountId?: string,
): Promise<AccountProfile>;

// Returns the account; redirect("/dashboard") unless role === "admin".
export async function requireAdmin(mockAccountId?: string): Promise<AccountProfile>;
```

`getCurrentAccount` changes: both branches return `{ ...profile, features: filterFeatures(resolvedFeatures) }` so unknown DB strings are dropped in Supabase **and** mock mode.

### `src/lib/data/profiles.ts`

```ts
import type { AccountProfile, Feature } from "@/types";

export function rowToProfile(row: Record<string, unknown>): AccountProfile;

// Admin-only read of every profile. Mock: Object.values(mockProfiles).
// Supabase: .from("profiles").select("id, role, features, travel_agent_id").order("created_at").
export async function listProfiles(): Promise<AccountProfile[]>;

// Admin-only write of a profile's features. Sanitizes via filterFeatures.
// Mock: mutate mockProfiles[id].features in place.
// Supabase: .from("profiles").update({ features: sanitized, updated_at }).eq("id", id)
//           .select("id, role, features, travel_agent_id").single();
export async function updateProfileFeatures(id: string, features: Feature[]): Promise<AccountProfile>;
```

> Admin authorization is enforced at the **server-action** layer (re-verify `role === "admin"`) and at the **RLS** layer. The data-layer functions mirror `travel-agents.ts` and do not themselves check role — this keeps the data layer role-agnostic and matches the existing convention where `travel-agents` actions rely on RLS.

### `src/app/dashboard/settings/accounts/actions.ts`

```ts
"use server";

export async function updateProfileFeaturesAction(
  profileId: string,
  features: Feature[],
): Promise<{ ok: boolean; error?: string }>;
// 1. account = await getCurrentAccount(await resolveMockAccountId());
// 2. if (account?.role !== "admin") return { ok: false, error: "No autorizado." };
// 3. try { await updateProfileFeatures(profileId, features); revalidatePath(...); return { ok: true } }
//    catch { return { ok: false, error: "Error al guardar los permisos." } }
```

## Supabase RLS (new migration `20260924000000_profiles_admin_update.sql`)

The migration is **additive** and restores admin read-all (dropped earlier for recursion) plus adds admin-only update, both built on a recursion-free helper:

```sql
-- Recursion-free admin check. security definer + row_security = off means the
-- function body reads profiles WITHOUT re-entering RLS (which is what caused
-- the original "infinite recursion" in profiles_admin_read_all).
create or replace function public.is_admin_account()
returns boolean
language sql
security definer
set search_path = public, pg_temp
set row_security = off
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Admin read-all (listProfiles). Restored using the helper, not a self-join.
create policy "profiles_admin_read_all" on profiles
  for select to authenticated
  using (public.is_admin_account());

-- Admin update of another profile's features.
create policy "profiles_admin_update_features" on profiles
  for update to authenticated
  using (public.is_admin_account())
  with check (public.is_admin_account());

-- Scoped column grant: authenticated can update ONLY features + updated_at.
grant update(features, updated_at) on profiles to authenticated;
```

Notes:

- **No broad grant.** `authenticated` already holds only `select` (from `20260916170000_account_profiles.sql`) plus `select` on `anon` (`20260917100500`). This migration adds column-scoped `update(features, updated_at)` only. An agent still cannot update their own or anyone's `features` because the single UPDATE policy's `using`/`with check` both require `is_admin_account()`.
- **`row_security = off` vs `FORCE RLS`**: `profiles` has `force row level security`, so table owners do not bypass RLS by default. The `set row_security = off` attribute on the `SECURITY DEFINER` function is the mechanism that lets the admin check read `profiles` without recursion. **This must be verified against the live Supabase environment during apply** (the migration test asserts the SQL shape; a functional RLS check runs in Supabase). Fallback if `row_security = off` is not honored by the definer role: make the function `security definer` owned by a role with `bypassrls`, or read the role from `auth.jwt()`/`raw_app_meta_data` instead of a `profiles` self-query.
- **Self-read untouched.** `profiles_self_read` and the `anon` select grant are not altered; the change never drops or modifies existing policies/columns/data (rollback = `drop policy` + `revoke update(features, updated_at)`).

## Admin UI structure

- **Server component** `page.tsx`: `await requireAdmin()` (redirects non-admins to `/dashboard`), then `const profiles = await listProfiles();` and renders `<FeatureManagerClient profiles={profiles} />`.
- **Client component** `FeatureManagerClient.tsx`: renders a table of profiles (id, role, linked agent) with one checkbox per `FEATURE_DEFINITIONS` entry. On change it calls `updateProfileFeaturesAction(profileId, nextFeatures)` inside `useTransition`, then `router.refresh()`. Disabled/read-only row styling for the currently-signed-in admin's own row is not required (admins see all features regardless of assignment) but the toggle set is derived solely from `FEATURE_DEFINITIONS` so the UI cannot invent features.
- **Persistence**: toggles persist through `updateProfileFeatures` → Supabase `.update({ features })` (RLS-gated) or in-memory `mockProfiles` mutation. `revalidatePath` refreshes the server-rendered list; nav gating reflects the change on the next request.
- **Mock parity**: the same `listProfiles`/`updateProfileFeatures` functions are used in both modes; only the branch inside them differs (identical to `travel-agents.ts`).

## Testing Strategy

Strict TDD is enabled (`openspec/config.yaml`: `strict_tdd: true`, `unit: npm run test`, Vitest). RED → GREEN → REFACTOR per task.

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (catalog) | `AVAILABLE_FEATURES` has exactly the 6 features in order; `FEATURE_DEFINITIONS` maps `whatsapp→/dashboard/wcc`, `travel-agents→/dashboard/travel-agents`, etc.; `isFeature`/`filterFeatures` drop unknown strings and preserve recognized ones. | `src/lib/__tests__/features.test.ts` |
| Unit (access) | `canAccessFeature` matrix: admin → true for every feature regardless of assignment; agent → only assigned; null → false. | `src/lib/__tests__/roles.test.ts` (extend) |
| Unit (guard) | `requireFeature`: admin passes; agent-with-feature passes; agent-without-feature redirects to `/dashboard`; null account redirects. `requireAdmin`: admin passes; agent redirects. Mock `next/navigation` `redirect` and `next/headers` `cookies`. | `src/lib/__tests__/roles.test.ts` (extend) |
| Unit (defensive filter) | `getCurrentAccount` returns `features: Feature[]` with unknown DB strings dropped, in **both** mock and Supabase branches. | `src/lib/__tests__/roles.test.ts` (extend) |
| Unit (write path) | `listProfiles` mock returns all; Supabase maps rows. `updateProfileFeatures` mock mutates in-memory (subsequent read reflects change); Supabase calls `.update({features, updated_at}).eq(id).select().single()`; unknown feature not persisted. | `src/lib/__tests__/profiles.test.ts` |
| Migration | New SQL contains the SECURITY DEFINER helper, admin read-all + update policies, and column-scoped `grant update(features, updated_at)`; asserts **no** broad `grant update on profiles`. | `src/lib/__tests__/profiles-admin-update-migration.test.ts` |
| Nav gating | Indirectly covered by `canAccessFeature` + `FEATURE_DEFINITIONS` unit tests; the layout renders each link iff `canAccessFeature` is true. A component/Playwright check is optional follow-up. | unit (indirect) + manual |
| Build | `npx tsc --noEmit` and `npm run build` pass; no client import of server-only modules. | `openspec/config.yaml` `build`/`typecheck` |

## Threat Matrix

`N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.`

The one security-sensitive boundary is the **Supabase RLS write policy** (privilege escalation: an agent updating their own or another profile's `features`). This is addressed as a design requirement rather than a matrix row:

- **Applicable control**: `profiles_admin_update_features` with `using`/`with check` both requiring `is_admin_account()`; column-scoped `grant update(features, updated_at)` only.
- **Expected safe behavior**: admin update succeeds and persists; agent update is rejected by RLS (and by the server-action admin re-check in mock mode).
- **Planned RED tests**: (a) migration test asserts the policy + scoped grant shape and the absence of a broad grant; (b) `updateProfileFeaturesAction` returns `{ ok:false }` for a non-admin account; (c) `updateProfileFeatures` mock path does not persist an unknown feature string.

## Migration / Rollout

No data migration is required — `features` already exists with default `'{}'`, and admins ignore it. The change is additive (new policies + scoped grant) and behaviorally reversible:

- **Rollout**: deploy behind the existing mock/Supabase dual-mode toggle; no destructive step. Agents whose nav changes from the old unconditional `Viajes`/`Clientes`/`Proveedores` to feature-gated links need their `features` seeded before/with rollout (documented behavior change; `mock-agent` gets `["trips", "clients"]`, and seeded Supabase agents get a default set assigned via the new admin UI).
- **Rollback (code)**: revert `layout.tsx` to `getCurrentUserRole`+`isAdmin`, remove the `requireFeature` guards and the accounts view; behavior returns to the prior binary split.
- **Rollback (schema)**: `drop policy "profiles_admin_read_all"; drop policy "profiles_admin_update_features"; revoke update(features, updated_at) on profiles from authenticated;` (or `supabase db reset`). Existing rows are untouched because the change never writes them unless an admin edits features.

## Open Questions

- [ ] Confirm the exact `row_security = off` / `bypassrls` mechanism works against `profiles` (which has `force row level security`) in the target Supabase instance. If not, fall back to a `bypassrls`-owned SECURITY DEFINER function or an `auth.jwt()`-based role check (documented above).
- [ ] Confirm the nav entry label for the admin-only view ("Cuentas" vs "Permisos") — cosmetic, default to "Cuentas".
- [ ] CommandPalette still loads all clients/trips regardless of features (explicitly out of scope; flagged as a conscious follow-up, not an oversight).
