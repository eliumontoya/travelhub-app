# Apply Progress: Client PIN Authentication

## Cumulative Task Status

### Phase 1: Foundation
- [x] 1.1 Create `supabase/migrations/20260916000000_client_pin_hash.sql` — add nullable `pin_hash text` to `clients`.
- [x] 1.2 Create `supabase/migrations/20260916010000_client_login_attempts.sql` — `client_login_attempts` table (RLS on, no anon policies).
- [x] 1.3 Add `ClientSession` type to `src/types/index.ts`.

### Phase 2: Data Layer — PIN Helpers (TDD)
- [x] 2.1 **RED**: Create `src/lib/data/__tests__/client-pin.test.ts` — failing tests for `setClientPin`, `getClientPinHashByEmail`, `hasClientPin` (mock-mode: hash stored, never plaintext; `rowToClient` never exposes hash).
- [x] 2.2 **GREEN**: Implement `setClientPin`, `getClientPinHashByEmail`, `hasClientPin` in `src/lib/data/clients.ts` (dual-mode: Supabase via service role + mock via `mockClientPinHashes` Map). Add mock stores to `src/lib/mock-data.ts`.
- [x] 2.3 Verify `rowToClient` in `clients.ts` does not map `pin_hash` to `Client` type.

### Phase 3: Auth Module (TDD)
- [x] 3.1 **RED**: Create `src/lib/__tests__/client-auth.test.ts` — failing tests for cookie sign/verify/tamper/expiry (`getClientSession`, `issueClientSession`, `destroyClientSession`).
- [x] 3.2 **RED**: Add failing tests for rate-limit window/reset/isolation and `verifyClientCredentials` (invalid, rate-limited, success-resets-counter, email-isolation).
- [x] 3.3 **GREEN**: Implement `src/lib/client-auth.ts` — HMAC-SHA256 cookie (`th-client-session`), `verifyClientCredentials`, dual-mode rate-limit store. Ref: `src/lib/whatsapp/signature.ts` pattern.

### Phase 4: UI & Integration
- [x] 4.1 Create `src/app/client/login/page.tsx` (email + PIN form) and `src/app/client/login/actions.ts` (`clientSignIn`, `clientLogout` server actions).
- [x] 4.2 Create `src/components/ClientSessionButton.tsx` — login/logout icon reading `getClientSession()`.
- [x] 4.3 Add `<ClientSessionButton />` next to `ThemeToggle` in `src/app/t/[slug]/page.tsx` and `src/app/c/[slug]/page.tsx`.
- [x] 4.4 Add PIN set/rotate input + server action in `src/app/dashboard/clients/[id]/` form.

### Phase 5: Verification
- [x] 5.1 Run `npm run test` — all unit tests pass.
- [x] 5.2 Run `npx tsc --noEmit` — typecheck clean.
- [x] 5.3 Run `npm run lint` — no lint errors.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 3.1 | `src/lib/__tests__/client-auth.test.ts` | Unit | N/A (new file) | Written | 6/6 passed | 6 cases (valid, missing, tampered, expired, destroy, options) | Extracted `signSession`/`verifySessionCookie`, constants |
| 3.2 | `src/lib/__tests__/client-auth.test.ts` | Unit | N/A (new file) | Written | 9/9 passed | 9 cases (unknown email, wrong PIN, valid, threshold, reset, isolation, limited-correct-pin, window expiry, sliding window) | Dual-mode rate-limit store behind internal helpers |
| 3.3 | `src/lib/__tests__/client-auth.test.ts` | Unit | N/A (new file) | Written | 15/15 passed | Covered above | Reused HMAC pattern from `src/lib/whatsapp/signature.ts`; pure cookie verify helper |
| 4.1 | `src/app/client/login/__tests__/actions.test.ts` | Unit | N/A (new file) | Written | 5/5 passed | 4 cases (valid, invalid, rate_limited, redirectTo) | None needed |
| 4.2 | `e2e/client-login.spec.ts` | E2E | N/A (new file) | N/A (UI component) | 3/3 passed | 3 cases (login/logout icon state, public pages without session) | N/A — icon is a thin server component |
| 4.3 | `e2e/client-login.spec.ts` | E2E | N/A (structural) | N/A (structural) | Build + E2E pass | Public trip/history pages still render without session | N/A — additive placement only |
| 4.4 | `src/lib/__tests__/client-pin-validation.test.ts` | Unit | N/A (new file) | Written | 7/7 passed | 7 cases (4-digit, 6-digit, too short, too long, non-numeric, mismatch, empty) | Extracted pure `validateClientPin` helper with constants |

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npx vitest run src/app/client/login/__tests__/actions.test.ts src/lib/__tests__/client-pin-validation.test.ts` → Test Files 2 passed (2), Tests 12 passed (12), Duration 154ms |
| Runtime harness command/scenario and exact result | `npm run build` → Compiled successfully, route `/client/login` generated; `npm run test:e2e` → 24 passed (includes new `e2e/client-login.spec.ts` covering login success/failure, logout icon, and unauthenticated public pages) |
| Rollback boundary | Delete `src/app/client/login/`, `src/components/ClientSessionButton.tsx`, `src/lib/client-pin-validation.ts`, their tests, and the additive edits to `src/app/t/[slug]/page.tsx`, `src/app/c/[slug]/page.tsx`, `src/app/dashboard/clients/[id]/page.tsx`, and `src/app/dashboard/clients/[id]/actions.ts`. Public pages and dashboard behavior remain unchanged. |

## Test Summary

- **Total tests written**: 12 (slice 3) / 37 (cumulative for this change)
- **Total tests passing**: 330 (full Vitest suite); 24 (full Playwright suite)
- **Layers used**: Unit (12), E2E (3 new scenarios)
- **Approval tests**: None — no refactoring tasks
- **Pure functions created**: `validateClientPin`

## Files Changed (this slice)

| File | Action | What Was Done |
|------|--------|---------------|
| `src/app/client/login/page.tsx` | Created | Public email + PIN login form with status messages and optional `redirectTo`. |
| `src/app/client/login/actions.ts` | Created | `clientSignIn` and `clientLogout` server actions wrapping `verifyClientCredentials` / `issueClientSession` / `destroyClientSession`. |
| `src/app/client/login/__tests__/actions.test.ts` | Created | RED→GREEN unit tests for success, invalid, rate-limited, and custom redirectTo paths. |
| `src/components/ClientSessionButton.tsx` | Created | Async server component that reads `getClientSession()` and renders a login link or logout form icon. |
| `src/app/t/[slug]/page.tsx` | Modified | Added `<ClientSessionButton returnTo={`/t/${slug}`} />` next to `ThemeToggle` in a fixed header container; no gating. |
| `src/app/c/[slug]/page.tsx` | Modified | Added `ThemeToggle` and `<ClientSessionButton returnTo={`/c/${slug}`} />` in a fixed header container; no gating. |
| `src/app/dashboard/clients/[id]/page.tsx` | Modified | Added a "PIN de acceso para el cliente" details block with PIN/confirm inputs, success/error banners, and kept open on feedback. |
| `src/app/dashboard/clients/[id]/actions.ts` | Modified | Added `updateClientPinAction` that validates with `validateClientPin`, calls `setClientPin`, and revalidates. |
| `src/lib/client-pin-validation.ts` | Created | Pure helper `validateClientPin(pin, confirmPin)` enforcing 4–6 digits and matching confirmation. |
| `src/lib/__tests__/client-pin-validation.test.ts` | Created | RED→GREEN unit tests for all validation branches. |
| `e2e/client-login.spec.ts` | Created | E2E coverage of dashboard PIN set → login → logout icon, invalid credentials, and public pages without session. |

## Deviations from Design

- Added `ThemeToggle` to `/c/[slug]` because that page did not already have one; `ClientSessionButton` is placed next to it in a fixed header container. This is purely additive and does not change public viewing behavior.
- Chose a 4–6 digit numeric PIN format in the agent form, resolving the open design question about PIN minimum length/format.

## Issues Found

- Two pre-existing ESLint warnings in `src/lib/__tests__/client-auth.test.ts` (unused `bcrypt` import and `_options` parameter) remain from Work Unit 2; no new warnings or errors were introduced by this slice.

## Workload / PR Boundary

- **Mode**: auto-chain, stacked-to-main
- **Current work unit**: Unit 3 — Login page, session button, header icon, dashboard PIN field
- **Boundary**: Starts after Unit 2 (auth module) and completes the change. All three work units are now implemented.
- **Estimated review budget impact**: This slice adds ~350 lines (UI, tests, E2E), keeping each PR within the 400-line budget.

## Status

4.1–4.4 and 5.1–5.3 complete. All 13 tasks complete. Ready for `sdd-verify` and archive.
