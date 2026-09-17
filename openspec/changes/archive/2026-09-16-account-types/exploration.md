# Exploration: Account Types (Admin vs Agent)

## Current State

TravelHub authentication is currently **mono-user**: any authenticated Supabase Auth user has full access to all dashboard functionality.

- `src/middleware.ts` only checks `auth.uid() is not null` for `/dashboard/**` protection; it does not inspect roles.
- `src/app/login/actions.ts` signs in with email/password and redirects to `/dashboard`; there is no role-based routing.
- All RLS policies use `auth.uid() is not null` (e.g., `0001_init.sql`, `0041_travel_agents.sql`, `20260826194451_whatsapp_inbound_data_foundation.sql`), granting every authenticated user identical read/write permissions.
- There is **no `profiles`/`users`/`accounts` table** linking Supabase Auth UUIDs to roles.
- There is **no `role` column or claim** in Supabase Auth metadata (`app_metadata`/`user_metadata`) anywhere in the codebase.
- The `travel_agents` table (introduced in `0041_travel_agents.sql`) is a **catalog of agents for trip assignment**, not a user-account/roles table. It has no foreign key to `auth.users`.
- Mock mode (`isSupabaseConfigured() === false`) bypasses auth entirely, so role validation would need an equivalent mock concept if the app must remain runnable without Supabase.
- The existing `auth-admin` spec baseline only covers authentication presence/absence and contact settings; it does not address authorization by role.

## Affected Areas

- `src/middleware.ts` — role check would gate `/dashboard/**` and redirect unauthorized users.
- `src/lib/supabase/server.ts` / `src/lib/supabase/middleware.ts` — helpers to read the current user and role would likely live here or in a new `src/lib/auth/roles.ts` module.
- `src/lib/data/shared.ts` / `src/lib/data.ts` — dual-mode facade would need a mock role representation and role-aware helpers.
- `supabase/migrations/` — a new migration would add a `profiles` or `accounts` table (or extend `travel_agents`) with a `role` column and update RLS policies to use role instead of just `auth.uid() is not null`.
- `src/types/index.ts` — add `AccountRole` / `UserProfile` types.
- `src/app/dashboard/layout.tsx` — nav may need to hide admin-only links (e.g., WCC, settings, travel-agents catalog) from non-admin agents.
- `src/app/dashboard/settings/` — role management UI would go here or under a new `/dashboard/admin/*` route.
- `src/app/login/actions.ts` — redirect logic after login may depend on role.
- `src/lib/mock-data.ts` — mock role data is required to preserve the no-Supabase dev experience.
- `src/lib/__tests__/data.test.ts` / `e2e/login.spec.ts` — tests would need to cover role enforcement.
- `openspec/specs/auth-admin/spec.md` — delta spec would likely modify or extend this baseline spec.

## Approaches

### 1. Supabase Auth `app_metadata` role claim

Store the role (`admin` | `agent`) in `auth.users.app_metadata.role`. Read it from the JWT/user object in middleware and Server Actions. Update RLS policies to compare `auth.jwt()->>'role'` (or a Postgres helper) against required roles.

- **Pros**
  - No extra database table; minimal schema change.
  - Fast to check in middleware because the role travels with the session/JWT.
  - Aligns with Supabase Auth conventions for custom claims.
- **Cons**
  - Roles can only be changed via Supabase Dashboard/Admin client or a secure server function; no in-app UI without service-role key.
  - Mock mode cannot replicate Supabase Auth metadata, so dev-without-Supabase would lose role validation unless a parallel mock implementation is added.
  - Updating a role requires sign-out/sign-in (or refresh) for the JWT to reflect the change.
- **Effort**: Low–Medium

### 2. Dedicated `profiles`/`accounts` table

Create a new migration that adds a `profiles` table (`id uuid primary key references auth.users(id), role text not null check (role in ('admin','agent')), ...`). Middleware/server helpers query this table to determine the current user's role. RLS policies join to `profiles` for authorization.

- **Pros**
  - Role is stored in Postgres, queryable and auditable.
  - Easy to build an in-app admin UI to assign/change roles.
  - Mock mode can mirror this with an in-memory `mockProfiles` map.
  - More flexible for future fields (name, phone, linked_travel_agent_id).
- **Cons**
  - Extra query on every session inspection (cacheable in middleware, but still adds latency).
  - Requires a trigger or admin setup to create a `profiles` row whenever a user is created in Supabase Auth.
  - RLS policies become more complex and need careful testing.
- **Effort**: Medium

### 3. Extend `travel_agents` into user accounts

Add an `auth_user_id uuid references auth.users(id)` column to `travel_agents` and treat rows as both agent profiles and login accounts. Users with a matching row are "agents"; a special marker or absence marks "admin".

- **Pros**
  - Reuses the existing catalog concept; every agent in the catalog could log in.
  - Natural fit if the business model is "each travel agent gets their own account".
- **Cons**
  - Conflates two concerns: the agent catalog (business metadata) and authentication/authorization.
  - Does not cleanly support multiple admin accounts or non-agent users.
  - Requires backfill/migration of existing `travel_agents` rows and careful handling of the mono-admin history.
- **Effort**: Medium–High

## Recommendation

**Approach 2 (dedicated `profiles`/`accounts` table)** is the best fit.

Rationale:

- It cleanly separates auth (Supabase Auth) from authorization (application role).
- It supports both an Administrator account and multiple Agent accounts without overloading the `travel_agents` catalog.
- It allows an admin UI inside the app to manage accounts, which matches the issue's wording about validating account types.
- It degrades gracefully in mock mode with a simple `mockProfiles` map, preserving the project's dual-mode design.
- Future work (linking an account to a `travel_agents` entry, per-agent filtering) is easier with a dedicated table.

A minimal first slice should:

1. Add a new migration with `profiles` (`id`, `role`, `created_at`, `updated_at`) and an optional `travel_agent_id` foreign key.
2. Update `src/lib/supabase/server.ts` or add `src/lib/auth/roles.ts` to expose `getCurrentUserRole()` and `requireRole()` helpers.
3. Update `src/middleware.ts` to reject non-admin/non-agent users from `/dashboard/**`.
4. Add mock-mode support in `src/lib/mock-data.ts`.
5. Add/update tests in `src/lib/__tests__/data.test.ts` and `e2e/login.spec.ts`.

## Risks

- **Ambiguity in the issue**: It is unclear whether "agent" means a user account with the agent role or an entry in the existing `travel_agents` catalog. This affects schema design and scope.
- **Scope creep**: The issue could expand into full user management (create/delete accounts, password resets, invite flows) if not bounded.
- **RLS regression**: Changing policies from `auth.uid() is not null` to role-based checks must be accompanied by tests; otherwise anonymous public reads for `/t/{slug}` could break.
- **Mock mode divergence**: Any role logic must be mirrored in mock data or the no-Supabase dev workflow will silently behave differently.
- **Supabase Auth user provisioning**: There is currently no sign-up flow; admins/agents must be created manually in Supabase. The change must document this operational step.

## Ready for Proposal

**Yes, with clarification.**

The orchestrator should ask the user to confirm:

1. Does "agent" refer to a **login account role**, or to an existing entry in the `travel_agents` catalog?
2. Should both admins and agents access the same `/dashboard/**` routes with different permissions, or should agents be restricted to a subset of routes/features (and if so, which ones)?
3. Is user/account provisioning (create/delete accounts, password reset) in scope, or should the first slice only enforce role validation on manually created Supabase Auth users?
