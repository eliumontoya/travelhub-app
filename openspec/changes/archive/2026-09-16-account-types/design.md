# Design: Account Types (Admin vs Agent)

## Technical Approach

Introduce a dual-mode role/authorization layer over the existing Supabase Auth session. A new `profiles` table becomes the single source of truth for role, feature assignment, and the account→`travel_agents` mapping; middleware and Server Components read it through a new `src/lib/auth/roles.ts` facade that mirrors the existing `isSupabaseConfigured()` dual-mode pattern (`src/lib/data/*`). Public `/t/{slug}` and `/c/{slug}` routes are untouched (middleware matcher remains `/dashboard/:path*`; public RLS policies remain role-agnostic).

## Architecture Decisions

### Decision 1: Role source — dedicated `profiles` table

**Choice**: Store role in a new `profiles` table (`id uuid references auth.users`, `role`, `features text[]`, `travel_agent_id`). Read role by querying `profiles` in middleware and Server Components.

**Alternatives considered**:
- *Supabase `app_metadata` claim*: role in JWT, no table. Rejected — violates *Mock-mode role parity* (mock has no Auth metadata; faking claims diverges from the dual-mode facade). Also needs session refresh, and the mapping would still require a table — splitting role/mapping across two sources.
- *Extend `travel_agents` into accounts*: add `auth_user_id`. Rejected — conflates business catalog with auth; no clean multi-admin.

**Rationale**: The `profiles` table cleanly separates Auth (Supabase) from authorization (app role), hosts the mandatory account→`travel_agents` mapping as `travel_agent_id` FK with `on delete set null` (satisfies "delete catalog entry nullifies mapping, never deletes account"), supports configurable features, and mirrors trivially in mock mode via an in-memory `mockProfiles` — exactly the existing domain pattern.

### Decision 2: Authorization enforcement surface

**Choice**: Role gating in Edge middleware (deny no-role) + role/feature-aware nav in `layout.tsx` and `requireRole()`/`canAccessFeature()` guards in Server Components. Do **not** rewrite existing domain-table `owner_all` RLS policies this slice.

**Alternatives considered**: Deep per-feature RLS on domain tables. Rejected for now — the final feature list is deferred, so per-feature data authorization can't be specified yet.

**Rationale**: Delivers all observable spec behavior without inventing an undefined permission matrix.

### Decision 3: Mock representation

**Choice**: `mock-data.ts` gains `mockProfiles` + a mutable `currentMockAccountId` (default = `admin`). `roles.ts` reads mock when `!isSupabaseConfigured()`; tests override the current account to simulate `agent`/no-role.

**Rationale**: Preserves the no-Supabase dev experience (default admin) while making agent/no-role states testable and demonstrable — full parity with production behavior.

## Data Flow

```
request /dashboard/** ──► middleware ──► updateSession() (getUser + profiles.role)
   configured & !user         ──► redirect /login?redirectTo=…
   configured & user & !role  ──► redirect /login?error=unauthorized
   !configured (mock)         ──► roles.ts → mockProfiles[currentMockAccountId]
Server Component ──► getCurrentUserRole/getCurrentAccount ──► profiles | mockProfiles
layout.tsx hides admin-only nav; requireRole/canAccessFeature guard features
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/20260916XXXXXX_account_profiles.sql` | Create | `profiles` table + RLS (self-read; admin-read-all; no app writes — provisioning out of scope) |
| `src/types/index.ts` | Modify | Add `AccountRole`, `AccountProfile` |
| `src/lib/auth/roles.ts` | Create | Role/feature/mapping helpers (dual-mode) |
| `src/lib/supabase/middleware.ts` | Modify | `updateSession` returns `role` |
| `src/middleware.ts` | Modify | Role gate on dashboard (supabase + mock) |
| `src/lib/mock-data.ts` | Modify | `mockProfiles`, `currentMockAccountId` |
| `src/app/dashboard/layout.tsx` | Modify | Hide admin-only nav for non-admin |

## Interfaces / Contracts

```ts
export type AccountRole = "admin" | "agent";

export interface AccountProfile {
  id: string;                 // auth.users id (mock: "mock-admin"/"mock-agent")
  role: AccountRole;
  features: string[];         // admin ignores; list deferred
  travelAgentId?: string;     // FK travel_agents.id
}

// src/lib/auth/roles.ts (all dual-mode, async)
getCurrentUserRole(): Promise<AccountRole | null>       // null = no recognized role
getCurrentAccount(): Promise<AccountProfile | null>
requireRole(...allowed: AccountRole[]): Promise<AccountRole> // throws/redirects
hasRole(role: AccountRole | null, allowed: AccountRole[]): boolean
canAccessFeature(profile: AccountProfile, feature: string): boolean // admin => true
getCurrentTravelAgentId(): Promise<string | null>
```

`updateSession(request)` → `{ response, user, role: AccountRole | null }`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | role enum/unknown→null; `hasRole`/`canAccessFeature` (admin always true); mapping resolution; null mapping stays valid | Vitest `src/lib/__tests__/roles.test.ts` (mock mode, RED first) |
| Integration | mock role parity via `mockProfiles` + `currentMockAccountId`; `rowToAccountProfile` mapping; Edge-safety (no Node APIs in roles/middleware path) | Vitest with `vi.mock("@/lib/supabase/server")` (existing pattern) |
| E2E | default admin reaches `/dashboard`; overridden no-role denied; agent sees reduced nav; public `/t/{slug}` anonymous | Playwright `e2e/login.spec.ts` + new role spec |

## Threat Matrix

N/A — no shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. This is HTTP middleware role-gating only.

## Migration / Rollout

Additive migration `profiles` (+ role-aware RLS on `profiles` only). Existing `owner_all` and public policies unchanged. Rollback: drop `profiles` and revert `src/middleware.ts` to `auth.uid()`-only. Manual operational step (out of scope): insert `profiles` rows for existing/agent Auth users (idempotent `on conflict do nothing`).

## Open Questions

- [ ] Final feature list (deferred by proposal) — feeds `features` array and later per-feature RLS.
- [ ] Deep per-feature data-layer RLS hardening (post feature-list): currently authenticated agents retain `owner_all` data access beyond UI gating — known residual gap.
