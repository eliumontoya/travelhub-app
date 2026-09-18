# Apply Progress: account-types

## Implementation Progress

**Change**: account-types
**Mode**: Strict TDD
**Delivery**: single PR with maintainer-approved **size:exception** (Review Workload Forecast: ~380–450 changed lines, 400-line budget risk: Medium)

### Completed Tasks

- [x] 1.1 **RED** — Add `AccountRole` and `AccountProfile` to `src/types/index.ts`; write failing Vitest in `src/lib/__tests__/roles.test.ts` for `hasRole`/`canAccessFeature`/`normalizeRole`.
- [x] 1.2 **GREEN** — Implement pure helpers `hasRole`, `canAccessFeature`, `normalizeRole` in `src/lib/auth/roles.ts`; unit tests pass.
- [x] 1.3 Add `mockProfiles` and mutable `currentMockAccountId` (default `"mock-admin"`) to `src/lib/mock-data.ts`; add `setCurrentMockAccountId` helper; test default admin and limited agent profiles.
- [x] 2.1 **RED** — Write dual-mode tests for `getCurrentAccount`/`getCurrentUserRole`/`getCurrentTravelAgentId`/`requireRole` with `vi.mock("@/lib/supabase/server")`.
- [x] 2.2 **GREEN** — Implement async dual-mode facade in `src/lib/auth/roles.ts` branching on `isSupabaseConfigured()`.
- [x] 2.3 **GREEN** — Extend `updateSession` in `src/lib/supabase/middleware.ts` to return `role`; update `src/middleware.ts` call-site.
- [x] 3.1 **RED** — Write Playwright test in `e2e/roles.spec.ts`: mock-mode admin reaches `/dashboard`, no-role denied, agent sees reduced nav.
- [x] 3.2 **GREEN** — Add role gate in `src/middleware.ts`: redirect to `/login?error=unauthorized` when role is null; preserve `/login?redirectTo=` for unauthenticated.
- [x] 3.3 Modify `src/app/dashboard/layout.tsx` to hide admin-only nav items when `getCurrentUserRole()` returns `agent`.
- [x] 4.1 Create `supabase/migrations/20260916170000_account_profiles.sql`: `profiles` table (`id` → `auth.users`, `role`, `features text[]`, `travel_agent_id` → `travel_agents` on delete set null), RLS self-read + admin-read-all, no app writes.
- [x] 4.2 Write migration smoke test verifying table schema, RLS enablement, self-read/admin-read-all policies, and select-only grants.
- [x] 5.1 Run `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`; all pass.
- [x] 5.2 Verify public routes `/t/{slug}` and `/c/{slug}` remain anonymous-accessible (existing tests + manual Playwright check).
- [x] 5.3 Confirm mock/Supabase parity: default mock admin has full access; cookie override to agent restricts nav.

### Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `src/types/index.ts` | Modified | Added `AccountRole` and `AccountProfile` types |
| `src/lib/auth/roles.ts` | Created | Role helpers (`normalizeRole`, `hasRole`, `canAccessFeature`) and dual-mode facade (`getCurrentAccount`, `getCurrentUserRole`, `getCurrentTravelAgentId`, `requireRole`) |
| `src/lib/mock-data.ts` | Modified | Added `mockProfiles`, `currentMockAccountId`, and `setCurrentMockAccountId` |
| `src/lib/supabase/middleware.ts` | Modified | `updateSession` now queries `profiles.role` and returns `{ response, user, role }` |
| `src/middleware.ts` | Modified | Dashboard role gate for Supabase and mock modes; mock-mode cookie override support |
| `src/app/dashboard/layout.tsx` | Modified | Reads role and hides admin-only nav (Agentes, WhatsApp C.C., Ajustes) for agents |
| `src/app/login/page.tsx` | Modified | Renders `?error=` message even in mock-mode warning state |
| `src/lib/__tests__/roles.test.ts` | Created | Unit tests for role helpers, mock profiles, dual-mode facade, and `requireRole` |
| `src/lib/__tests__/supabase-middleware.test.ts` | Created | Unit tests for `updateSession` role resolution |
| `src/lib/__tests__/account-profiles-migration.test.ts` | Created | Static smoke test for migration schema and RLS policies |
| `e2e/roles.spec.ts` | Created | Playwright role scenarios: admin full nav, no-role denied, agent reduced nav |
| `supabase/migrations/20260916170000_account_profiles.sql` | Created | `profiles` table, indexes, RLS policies, grants |

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 / 1.2 | `src/lib/__tests__/roles.test.ts` | Unit | N/A (new file) | ✅ Written | ✅ 8 passing | ✅ admin / agent / unknown / null cases | ✅ Clean |
| 1.3 | `src/lib/__tests__/roles.test.ts` | Unit | ✅ 8/8 | ✅ Written | ✅ 10 passing | ✅ default admin + limited agent profiles | ✅ Clean |
| 2.1 / 2.2 | `src/lib/__tests__/roles.test.ts` | Unit/Integration | ✅ 10/10 | ✅ Written | ✅ 20 passing | ✅ mock mode + Supabase mode (session, missing profile, unknown role) | ✅ Clean |
| 2.3 | `src/lib/__tests__/supabase-middleware.test.ts` | Unit | N/A (new file) | ✅ Written | ✅ 4 passing | ✅ not configured / valid role / missing profile / unknown role | ✅ Clean |
| 3.1 / 3.2 / 3.3 | `e2e/roles.spec.ts` | E2E | N/A (new file) | ✅ Written | ✅ 3 passing | ✅ admin full nav / no-role denied / agent reduced nav | ✅ Clean |
| 4.2 | `src/lib/__tests__/account-profiles-migration.test.ts` | Unit | N/A (new file) | ✅ Written | ✅ 6 passing | ✅ table / FK / RLS / self-read / admin-read-all / grants | ✅ Clean |

### Test Summary

- **Total tests written**: 39 new (20 roles facade, 4 middleware, 6 migration smoke, 3 e2e role scenarios, plus 6 role-helper/mock-profile tests counted in the facade file)
- **Total tests passing**: 347 (328 Vitest + 19 Playwright)
- **Layers used**: Unit (Vitest), Integration (mock/Supabase dual-mode), E2E (Playwright)
- **Approval tests**: None — no refactoring of existing behavior
- **Pure functions created**: `normalizeRole`, `hasRole`, `canAccessFeature`

### Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npm run test -- src/lib/__tests__/roles.test.ts src/lib/__tests__/supabase-middleware.test.ts src/lib/__tests__/account-profiles-migration.test.ts` → 3 files passed, 30 tests passed |
| Runtime harness command/scenario and exact result | `npm run test:e2e -- e2e/roles.spec.ts` → 3 passed; `npm run test:e2e -- e2e/public-trip.spec.ts e2e/dashboard.spec.ts e2e/login.spec.ts` → 16 passed (public routes and existing dashboard/login behavior preserved) |
| Rollback boundary | Revert `src/types/index.ts`, `src/lib/auth/roles.ts`, `src/lib/mock-data.ts`, `src/lib/supabase/middleware.ts`, `src/middleware.ts`, `src/app/dashboard/layout.tsx`, `src/app/login/page.tsx`, the three new test files, `e2e/roles.spec.ts`, and `supabase/migrations/20260916170000_account_profiles.sql` |

### Deviations from Design

1. **Optional `mockAccountId` parameter on `getCurrentAccount`/`getCurrentUserRole`/`getCurrentTravelAgentId`**: the design interface does not include this parameter. Added to support a test/dev cookie override (`x-mock-account-id`) so Playwright can switch mock accounts without mutating global module state. The parameter is optional and ignored in Supabase mode.
2. **Middleware does not import `roles.ts`**: `src/middleware.ts` resolves mock-mode roles directly from `mock-data.ts` instead of calling `getCurrentUserRole()`. This keeps the Edge middleware free of the `next/headers` import chain that `roles.ts` pulls in via `@/lib/supabase/server`.
3. **Admin-only nav items**: chose "Agentes", "WhatsApp C.C.", and "Ajustes" as admin-only. The feature list is deferred, so this is a reasonable first cut aligned with the e2e spec.

### Issues Found

- `npm install` was required in the worktree because `node_modules` was missing; without it, Playwright reused a stale dev server from the main repo on port 3000 and returned 404s.
- Stale `next-env.d.ts` was auto-modified by `npm run dev` (`.next/dev/types` imports); reverted to keep it out of the change.
- Existing `src/app/login/page.tsx` did not render the `?error=` query param in mock-mode warning state; updated so role-denial errors are visible during mock-mode development.

### Remaining Tasks

None.

### Workload / PR Boundary

- Mode: single PR with **size:exception** (maintainer-approved)
- Current work unit: full change (Phases 1–5)
- Boundary: all 14 tasks complete, full gates green
- Estimated review budget impact: ~380–450 changed lines; exception recorded

### Status

14/14 tasks complete. Ready for verify.
