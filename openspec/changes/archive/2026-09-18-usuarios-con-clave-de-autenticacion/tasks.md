# Tasks: Client PIN Authentication

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~700 (migrations ~30, data layer ~100, auth module ~200, UI ~230, tests ~140) |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Foundation + Data) → PR 2 (Auth Module) → PR 3 (UI + Integration) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Migrations + types + PIN data-layer helpers + mock stores | PR 1 | `npx vitest run src/lib/data/__tests__/client-pin.test.ts` | Vitest (unit) | Remove migrations, PIN helpers in `clients.ts`, mock stores in `mock-data.ts`; no runtime impact |
| 2 | Cookie sign/verify/destroy, PIN verify, rate-limit module | PR 2 | `npx vitest run src/lib/__tests__/client-auth.test.ts` | Vitest (unit) | Remove `client-auth.ts`; no page or cookie behavior exists yet |
| 3 | Login page, session button, header icon, dashboard PIN field | PR 3 | `npm run test` + `npx tsc --noEmit` | Vitest + Playwright (e2e) | Remove login page, button, icon additions, dashboard PIN field; public pages unchanged |

## Phase 1: Foundation

- [x] 1.1 Create `supabase/migrations/20260916000000_client_pin_hash.sql` — add nullable `pin_hash text` to `clients`.
- [x] 1.2 Create `supabase/migrations/20260916010000_client_login_attempts.sql` — `client_login_attempts` table (RLS on, no anon policies).
- [x] 1.3 Add `ClientSession` type to `src/types/index.ts`.

## Phase 2: Data Layer — PIN Helpers (TDD)

- [x] 2.1 **RED**: Create `src/lib/data/__tests__/client-pin.test.ts` — failing tests for `setClientPin`, `getClientPinHashByEmail`, `hasClientPin` (mock-mode: hash stored, never plaintext; `rowToClient` never exposes hash).
- [x] 2.2 **GREEN**: Implement `setClientPin`, `getClientPinHashByEmail`, `hasClientPin` in `src/lib/data/clients.ts` (dual-mode: Supabase via service role + mock via `mockClientPinHashes` Map). Add mock stores to `src/lib/mock-data.ts`.
- [x] 2.3 Verify `rowToClient` in `clients.ts` does not map `pin_hash` to `Client` type.

## Phase 3: Auth Module (TDD)

- [x] 3.1 **RED**: Create `src/lib/__tests__/client-auth.test.ts` — failing tests for cookie sign/verify/tamper/expiry (`getClientSession`, `issueClientSession`, `destroyClientSession`).
- [x] 3.2 **RED**: Add failing tests for rate-limit window/reset/isolation and `verifyClientCredentials` (invalid, rate-limited, success-resets-counter, email-isolation).
- [x] 3.3 **GREEN**: Implement `src/lib/client-auth.ts` — HMAC-SHA256 cookie (`th-client-session`), `verifyClientCredentials`, dual-mode rate-limit store. Ref: `src/lib/whatsapp/signature.ts` pattern.

## Phase 4: UI & Integration

- [x] 4.1 Create `src/app/client/login/page.tsx` (email + PIN form) and `src/app/client/login/actions.ts` (`clientSignIn`, `clientLogout` server actions).
- [x] 4.2 Create `src/components/ClientSessionButton.tsx` — login/logout icon reading `getClientSession()`.
- [x] 4.3 Add `<ClientSessionButton />` next to `ThemeToggle` in `src/app/t/[slug]/page.tsx` and `src/app/c/[slug]/page.tsx`.
- [x] 4.4 Add PIN set/rotate input + server action in `src/app/dashboard/clients/[id]/` form.

## Phase 5: Verification

- [x] 5.1 Run `npm run test` — all unit tests pass.
- [x] 5.2 Run `npx tsc --noEmit` — typecheck clean.
- [x] 5.3 Run `npm run lint` — no lint errors.
