# Tasks: Client Home Page (`pagina-principal-para-cliente`)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~450 (additions + deletions) |
| 800-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | None — single PR (450 < 800) |
| Delivery strategy | auto-chain |
| Chain strategy | N/A (single PR) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: N/A (single PR)
800-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Commit slice | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Data helpers + view models + unit tests | commit 1 | `npm run test -- client-home-data` | N/A — pure data helpers, no runtime surface | `src/types/index.ts` (ClientHomeTrip, ClientProfileForHome), `src/lib/data/clients.ts` (getClientProfileForHome), `src/lib/data/trips.ts` (getClientHomeTrips), `src/lib/__tests__/client-home-data.test.ts` |
| 2 | `/client` page (session gate, profile, filtered trip list, logout) + page tests | commit 2 | `npm run test -- client/__tests__/page` | `npm run dev` → visit `/client` unauthenticated → redirects to `/client/login` | `src/app/client/page.tsx`, `src/app/client/__tests__/page.test.tsx` |
| 3 | Login redirect default + e2e | commit 3 | `npm run test -- client/login/actions` | `npm run test:e2e -- client-home` | `src/app/client/login/actions.ts`, `src/app/client/login/page.tsx`, `e2e/client-home.spec.ts` |

## Phase 1: Data Layer (TDD — Unit 1 / PR 1)

- [x] 1.1 **RED** — Create `src/lib/__tests__/client-home-data.test.ts` with failing tests for: `getClientProfileForHome` returns whitelisted fields (no `id`, `slug`, `createdAt`); `getClientHomeTrips` returns `draft`+`published`, excludes `archived`; field-leak guard asserts `!("commissionRate" in t)` and `!("internalNotes" in t)`; `salePrice` + agent present; degradation (Supabase configured, no service key → `null`/`[]`). Run `npm run test -- client-home-data` — must fail.
- [x] 1.2 Add `ClientHomeTrip` and `ClientProfileForHome` types to `src/types/index.ts` (whitelist `Pick` per design).
- [x] 1.3 Implement `getClientProfileForHome(clientId)` in `src/lib/data/clients.ts` using `getSupabaseAdmin()` + `canUseServiceRole()` branch; re-export via `src/lib/data.ts`.
- [x] 1.4 Implement `getClientHomeTrips(clientId)` in `src/lib/data/trips.ts`: read `trip_clients` for `trip_id`s, filter `trips` to `status in (draft, published)`, batch-resolve agent names via `travel_agents.in()`; re-export via `src/lib/data.ts`.
- [x] 1.5 **GREEN** — Run `npm run test -- client-home-data` — all tests pass. Run `npx tsc --noEmit` and `npm run lint`.
- [x] 1.6 Commit work unit 1.

## Phase 2: Client Home Page (TDD — Unit 2 / PR 2)

- [x] 2.1 **RED** — Create `src/app/client/__tests__/page.test.tsx` with failing tests: no session → `redirect("/client/login")` called; authenticated renders profile fields (`name`, `email`, `phone`, `whatsapp`, `birthDate`, `notes`, `referralSource`, `coverImageUrl`); draft trip renders status but no `/t/{slug}` link; published trip renders `/t/{slug}` link; logout form present. Mock `getClientSession`, data helpers, and `next/navigation` `redirect`. Run `npm run test -- client/__tests__/page` — must fail.
- [x] 2.2 Create `src/app/client/page.tsx` (Server Component): call `getClientSession()` → redirect on null; render read-only profile via `getClientProfileForHome`; render filtered trip list via `getClientHomeTrips` (published → `/t/{slug}` link, draft → status only); include logout form posting to existing `clientLogout` action.
- [x] 2.3 **GREEN** — Run `npm run test -- client/__tests__/page` — all tests pass. Run `npx tsc --noEmit` and `npm run lint`.
- [x] 2.4 Commit work unit 2.

## Phase 3: Login Redirect + E2E (Unit 3 / PR 3)

- [x] 3.1 **RED** — Update `src/app/client/login/__tests__/actions.test.ts`: assert default redirect on successful login targets `/client`. Run `npm run test -- client/login/actions` — must fail.
- [x] 3.2 Modify `src/app/client/login/actions.ts`: `clientSignIn` fallback redirect → `/client`.
- [x] 3.3 Modify `src/app/client/login/page.tsx`: hidden `redirectTo` input default value → `/client`.
- [x] 3.4 **GREEN** — Run `npm run test -- client/login/actions` — passes. Run `npx tsc --noEmit` and `npm run lint`.
- [x] 3.5 Create `e2e/client-home.spec.ts` (Playwright, mock mode): login → lands on `/client` → sees profile + trips → logout → redirected to `/client/login` → re-login succeeds. Run `npm run test:e2e -- client-home`.
- [x] 3.6 Commit work unit 3.

## Phase 4: Final Verification

- [x] 4.1 Run full suite: `npx tsc --noEmit && npm run lint && npm run test && npm run build`.
- [x] 4.2 Verify all spec scenarios satisfied (client-home: 10 scenarios; client-auth: successful login redirect).
