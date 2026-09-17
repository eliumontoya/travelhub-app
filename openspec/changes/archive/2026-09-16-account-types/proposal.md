# Proposal: Account Types (Admin vs Agent)

## Intent

TravelHub auth is mono-user: any authenticated Supabase user gets full dashboard access. Introduce two account types — **admin** (all features) and **agent/asesor** (feature-level access) — and validate roles on manually-provisioned Supabase Auth accounts.

## Scope

### In Scope

- Role model: `admin` and `agent` roles on authenticated accounts.
- Role validation on `/dashboard/**` (reject/handle users with no valid role).
- Feature-level access for agents; model must support configurable/assignable features (feature list deferred).
- Link an `agent` auth account to its `travel_agents` (asesor) entry.
- Role helpers + mock-mode role representation (preserve dual-mode data access).

### Out of Scope

- Account provisioning: create/delete accounts, password reset, role-assignment UI.
- Final feature list / granular feature permissions (model only).
- Public `/t/{slug}` and `/c/{slug}` access changes.

## Capabilities

### New Capabilities

- `account-roles`: role model (`admin`/`agent`), role-based authorization, feature-level agent access, and the account→`travel_agents` (asesor) mapping.

### Modified Capabilities

- `auth-admin`: dashboard protection inspects role (not just auth presence); role enforcement works in mock mode.
- `travel-agent-catalog`: an agent account can map to a `travel_agents` record.

## Approach

Add a role source (dedicated `profiles`/`accounts` table or Supabase `app_metadata` claim) with a `role` column; expose `getCurrentUserRole()` / `requireRole()` helpers; gate middleware; mirror roles in mock data.

**Open design decision (resolve in sdd-design):** where role authorization lives — Supabase side (`app_metadata`/JWT) vs app-side table. Do not silently pick one.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/migrations/` | New | Migration for role source + role-aware RLS |
| `src/middleware.ts` | Modified | Role gate for `/dashboard/**` |
| `src/lib/auth/roles.ts` | New | Role helpers |
| `src/lib/data.ts` / `src/lib/mock-data.ts` | Modified | Mock role representation |
| `src/app/dashboard/layout.tsx` | Modified | Hide admin-only nav for agents |
| `src/lib/__tests__/`, `e2e/login.spec.ts` | Modified | Role enforcement tests |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| RLS regression breaks public trip reads | Med | Keep public policies role-agnostic; test `/t/{slug}`, `/c/{slug}` |
| Mock/Supabase divergence | Med | Mirror roles in mock-data; dual-mode tests |
| Role source ambiguity (app_metadata vs table) | Med | Resolve explicitly in design phase; block apply until decided |
| Scope creep into provisioning | Med | Out-of-scope boundary; validate only on manually-created accounts |

## Rollback Plan

Revert the migration (add down-migration or restore prior schema), restore `src/middleware.ts` to `auth.uid()`-only check, and drop role helpers. Auth reverts to mono-user without data loss (roles are additive metadata).

## Dependencies

- Supabase Auth users created manually (operational step; no sign-up flow).

## Success Criteria

- [ ] Admin account reaches all dashboard features; agent account limited to assigned features.
- [ ] User with no valid role is denied `/dashboard/**`.
- [ ] Public `/t/{slug}` and `/c/{slug}` reads remain anonymous-accessible.
- [ ] Mock mode enforces the same roles without Supabase.
