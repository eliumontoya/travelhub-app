# Exploration: Per-agent feature system in the dashboard (issue #304)

## Current State

The role model (`admin` / `agent`) and the data plumbing for per-agent features are **already in place** from issue #300. What is missing is only the consumption of `features` in the dashboard UI, plus a couple of peripheral pieces.

- **`src/lib/auth/roles.ts`** already exports a correct, tested `canAccessFeature(profile, feature)`:
  - `null` profile → `false`
  - `role === "admin"` → `true` (ignores the `features` array)
  - `agent` → `profile.features.includes(feature)`
  - Also exports `getCurrentAccount(mockAccountId?)` which resolves the **full** `AccountProfile` (id, role, features, travelAgentId) from Supabase (`profiles` table: `select("id, role, features, travel_agent_id")`) or from `mockProfiles`.
- **`src/types/index.ts`** defines `AccountProfile.features: string[]` and `AccountRole = "admin" | "agent"` (lines 13–20).
- **`src/lib/mock-data.ts`** defines `mockProfiles`: `mock-admin` (`role: "admin"`, `features: []`) and `mock-agent` (`role: "agent"`, `features: ["trips"]`, `travelAgentId: "a1"`).
- **`supabase/migrations/20260916170000_account_profiles.sql`** creates `profiles` with `features text[] not null default '{}'` and RLS that grants **only SELECT** to authenticated users (self-read + admin-read-all). There are **no write policies** — provisioning/feature assignment is a manual operational step by design (migration comments say so explicitly).
- **`src/app/dashboard/layout.tsx`** is the gap. It calls `getCurrentUserRole(mockAccountId)` and computes `const isAdmin = role === "admin"`, then gates the nav with `{isAdmin && (...)}` around **Agentes** (`/dashboard/travel-agents`), **WhatsApp C.C.** (`/dashboard/wcc`), and **Ajustes** (`/dashboard/settings`). It never calls `getCurrentAccount` nor `canAccessFeature`. Dashboard, Viajes, Clientes, Proveedores are rendered **unconditionally** for both roles today.
- **Route-level enforcement** (`src/middleware.ts` + `src/lib/supabase/middleware.ts`) only checks the presence of a valid **role** (`admin`/`agent`), not features. So a `agent` without the `settings` feature can still navigate directly to `/dashboard/settings` today (nothing hides or blocks it).
- **No `AVAILABLE_FEATURES` constant exists anywhere** in the codebase.
- **No admin-facing UI or data function** to list profiles or update `features` exists (`src/lib/data/*` has no `profiles`/`getProfiles`/`updateProfile` references).
- **Existing tests**: `src/lib/__tests__/roles.test.ts` covers `canAccessFeature` (admin, agent assigned/unassigned, null) and the dual-mode `getCurrentAccount`/`getCurrentUserRole`/`getCurrentTravelAgentId`; `src/lib/__tests__/account-profiles-migration.test.ts` covers the migration. There is **no** test for the layout nav.

## Affected Areas

- `src/lib/auth/roles.ts` — natural home for `AVAILABLE_FEATURES` and any "always-visible for agents" policy helper (it already owns `canAccessFeature`).
- `src/app/dashboard/layout.tsx` — must switch from `getCurrentUserRole` + `isAdmin` to `getCurrentAccount` + `canAccessFeature` and wrap each gated nav link per feature.
- `src/types/index.ts` — possibly add a `Feature` union/literal type (currently `features: string[]` is untyped string).
- `src/lib/mock-data.ts` — update `mock-agent` `features` to a realistic default set depending on the "always-visible" decision.
- `supabase/migrations/*` — a new migration **only if** we add an admin write policy for feature assignment (for the optional management UI); otherwise manual SQL provisioning suffices.
- `src/middleware.ts` / `src/lib/supabase/middleware.ts` — **only if** we add route-level (not just nav-level) feature enforcement.
- Dashboard route pages (`src/app/dashboard/travel-agents/page.tsx`, `settings/page.tsx`, `wcc/page.tsx`) — **only if** we add per-route guards (server-side redirect for unauthorized feature).
- `src/components/CommandPalette.tsx` / layout data load — the layout eagerly loads **all** clients and trips for the command palette regardless of role; a feature-gated agent without `clients` would still get client search results. Worth deciding whether to scope this.
- `src/lib/__tests__/roles.test.ts` — extend for the new constant/policy helpers.

## Approaches

1. **Nav-only gating (minimal, core issue scope)** — Define `AVAILABLE_FEATURES`, map each nav link to a feature, switch layout to `getCurrentAccount` + `canAccessFeature`. No route guards, no write policy, no admin UI.
   - Pros: Smallest diff, directly satisfies issue items (1)+(2), low risk, mock+Supabase parity already provided by `getCurrentAccount`.
   - Cons: Hiding the link does **not** block direct URL access to gated routes; an agent can still reach `/dashboard/settings`. Leaves acceptance "deny access" only partially met (spec permits "deny **or** hide", so it is technically compliant but weaker security).

2. **Nav gating + route-level feature guards (recommended)** — Approach 1 plus a shared server-side guard (e.g. a helper `requireFeature(feature)` in `roles.ts`, or a per-page check in `travel-agents`/`wcc`/`settings` pages) that redirects an agent lacking the feature. Mock mode mirrors the same logic via `getCurrentAccount`.
   - Pros: Real enforcement, matches spec scenario "Agent denied unassigned feature" robustly; uses the existing App Router/server-component convention; still no DB write policy needed.
   - Cons: Slightly larger surface (3 gated pages + a helper); must decide redirect target (dashboard vs. an "unauthorized" state).

3. **Full system incl. admin feature-management UI (optional item 4)** — Approaches 1+2 plus a new migration adding an admin-only `UPDATE` policy on `profiles.features`, a data-layer `listProfiles`/`updateProfileFeatures` (with mock parity), and a UI (likely in the travel-agents catalog or a settings tab) for admins to toggle features per agent account.
   - Pros: Fully delivers "features configurables por agente" from the UI; completes the story end-to-end.
   - Cons: Highest effort; new write path + RLS policy + mock source-of-truth; the issue explicitly marks it optional.

## Recommendation

**Approach 2** (nav gating + route-level guards), scoped as follows, and defer **Approach 3** (admin UI) unless the product owner wants it in this change:

- Add `AVAILABLE_FEATURES` (as a typed `Feature` union: `"trips" | "clients" | "suppliers" | "travel-agents" | "whatsapp" | "settings"`) and a feature→route/label mapping in `src/lib/auth/roles.ts` (or a sibling `features.ts`), reusing `canAccessFeature`.
- Switch `layout.tsx` to `getCurrentAccount(mockAccountId)` and gate each nav link with `canAccessFeature(account, "<feature>")`; keep the Dashboard home link unconditional.
- Add a server-side `requireFeature` guard to `/dashboard/travel-agents`, `/dashboard/wcc`, and `/dashboard/settings` pages so direct navigation is blocked, mirroring mock mode.
- Update `mock-agent` `features` and extend `roles.test.ts` for the new constant + guard.

**Open product decision to resolve before proposal** (flag in "Ready for Proposal"): the issue explicitly asks to *consider* whether some features are always visible to every agent (e.g. `trips`, `clients`). Today the base nav (Dashboard, Viajes, Clientes, Proveedores) is shown unconditionally; strict `canAccessFeature` gating would hide `clients`/`suppliers` from `mock-agent` (which only has `["trips"]`). Two coherent policies:
  - **(a) fully configurable** — every feature except the dashboard home must be explicitly assigned.
  - **(b) base + optional** — a small always-on set for agents (`trips`, `clients`, and possibly `suppliers`) plus opt-in extras (`travel-agents`, `whatsapp`, `settings`).

This decision changes the mock data, the helper semantics, and the acceptance tests, so it must be settled up front.

## Risks

- **Direct-URL bypass** if only Approach 1 is chosen — hiding nav links is not authorization.
- **Behavior change for existing agents**: strict gating could hide Clientes/Proveedores from agents who relied on the unconditional base nav; must be reconciled with the "always-visible" decision.
- **CommandPalette leakage**: layout loads all clients/trips for the palette regardless of `features`; a `clients`-less agent still searches clients. Needs an explicit scope decision.
- **No DB write path** means Supabase feature assignment is a manual SQL step unless Approach 3 is in scope; acceptance "features configurables por agente en BD" is only fully met by manual provisioning.
- **Untyped `features: string[]`** allows typos that silently match nothing; a typed union + `AVAILABLE_FEATURES` reduces this.

## Ready for Proposal

Yes — with one blocking product decision for the orchestrator to relay to the user:

1. **Always-visible features**: should `trips` / `clients` / `suppliers` be always-on for every agent (base set), or fully configurable per agent (only the dashboard home unconditional)?
2. **Route-level enforcement**: confirm agents without a feature must be *blocked* (redirected), not just *hidden* — this pulls the gated pages + a guard helper into scope.
3. **Admin management UI (item 4)**: confirm whether it is in scope now or deferred (it requires a new `profiles` write migration + mock parity).

Everything else (constant, layout switch to `getCurrentAccount`, mock parity, tests) is unambiguous and ready to spec/design.
