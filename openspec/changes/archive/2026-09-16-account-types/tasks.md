# Tasks: Account Types (Admin vs Agent)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~380–450 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Role model + facade + mock parity | PR 1 | `npm run test -- roles` | Vitest mock-mode scenarios | Revert `src/types/index.ts`, `src/lib/auth/roles.ts`, `src/lib/mock-data.ts` |
| 2 | Middleware gate + layout nav + migration | PR 1 (same) | `npm run test:e2e -- login` | Playwright role scenarios | Revert `src/middleware.ts`, `src/lib/supabase/middleware.ts`, `src/app/dashboard/layout.tsx`, migration |

## Phase 1: Foundation — Types and Mock Data (RED → GREEN)

- [x] 1.1 RED: add `AccountRole` and `AccountProfile` types in `src/types/index.ts`; write failing Vitest in `src/lib/__tests__/roles.test.ts` asserting `hasRole`/`canAccessFeature`/unknown→null.
- [x] 1.2 GREEN: implement pure helpers `hasRole`, `canAccessFeature`, `normalizeRole` in `src/lib/auth/roles.ts` (no Supabase import yet); make unit tests pass.
- [x] 1.3 Add `mockProfiles` and mutable `currentMockAccountId` (default `"mock-admin"`) to `src/lib/mock-data.ts`; write test asserting mock admin resolves role `admin`.

## Phase 2: Core — Dual-Mode Role Facade (RED → GREEN)

- [x] 2.1 RED: write tests for `getCurrentUserRole`/`getCurrentAccount`/`getCurrentTravelAgentId` using `vi.mock("@/lib/supabase/server")`; assert mock-mode returns mock profile, Supabase-mode queries `profiles`.
- [x] 2.2 GREEN: implement `getCurrentUserRole`, `getCurrentAccount`, `requireRole`, `getCurrentTravelAgentId` in `src/lib/auth/roles.ts` branching on `isSupabaseConfigured()`.
- [x] 2.3 RED→GREEN: extend `updateSession` in `src/lib/supabase/middleware.ts` to return `role` (join `profiles`); update call-sites in `src/middleware.ts`.

## Phase 3: Integration — Middleware Gate and Layout

- [x] 3.1 RED: write Playwright test in `e2e/roles.spec.ts` — mock-mode admin reaches `/dashboard`, overridden no-role is denied, agent sees reduced nav.
- [x] 3.2 GREEN: add role gate in `src/middleware.ts` — redirect to `/login?error=unauthorized` when role is null; preserve existing `/login?redirectTo=` for unauthenticated.
- [x] 3.3 Modify `src/app/dashboard/layout.tsx` to hide admin-only nav items when `getCurrentUserRole()` returns `agent`.

## Phase 4: Database Migration

- [x] 4.1 Create `supabase/migrations/20260916XXXXXX_account_profiles.sql` — `profiles` table (`id uuid references auth.users`, `role text`, `features text[]`, `travel_agent_id uuid references travel_agents on delete set null`), RLS (self-read, admin-read-all), no app writes. Note: apply stamps real timestamp in place of `XXXXXX`.
- [x] 4.2 Write migration smoke test verifying `profiles` table exists and RLS blocks non-admin/non-self reads.

## Phase 5: Verification and Cleanup

- [x] 5.1 Run `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`; fix any failures.
- [x] 5.2 Verify public routes `/t/{slug}` and `/c/{slug}` remain anonymous-accessible (existing tests + manual Playwright check).
- [x] 5.3 Confirm mock/Supabase parity: default mock admin has full access; switching `currentMockAccountId` to agent restricts nav.
