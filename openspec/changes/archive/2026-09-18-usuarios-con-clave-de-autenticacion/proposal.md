# Proposal: Client PIN Authentication

## Intent

Lay groundwork for future client-gated features: a per-client PIN plus email+PIN login issuing a signed session cookie. Published trips stay viewable by bare URL — no current page is gated. Issue #302 adds the PIN, login page, and session helpers only.

## Scope

### In Scope
- Nullable `clients.pin_hash` (bcrypt) migration; agent sets/rotates the PIN in the client form.
- `/client/login` page (email + PIN) issuing a signed `HttpOnly` session cookie.
- Session verify/logout helpers + per-email rate limiting.
- Login icon in the header on public trip pages.
- Mock-mode parity.

### Out of Scope
- Gating `/t/{slug}` or `/c/{slug}` behind a session — public viewing stays unauthenticated.
- Supabase Auth per-client users (Approach B); shared agency PIN (Approach C).
- Client self-service PIN recovery/OTP — the agent resets the PIN.

## Capabilities

### New Capabilities
- `client-auth`: email+PIN login, signed `HttpOnly` session cookie, verify/logout, per-email rate limiting.

### Modified Capabilities
- `client-crm`: nullable hashed `pin` column + agent set/rotate.

## Approach

**Approach A** — per-client PIN, custom signed session cookie:

- `src/lib/client-auth.ts` owns cookie issue/verify/destroy, PIN verification, rate limiting.
- Store bcrypt-hashed PINs; never log or render them.
- Login page and header icon are additive; public pages keep unauthenticated rendering.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/migrations/` | New | `clients.pin_hash` |
| `src/types/index.ts` | Modified | `pin_hash?` + session type |
| `src/lib/data/clients.ts` | Modified | `rowToClient`, PIN helpers |
| `src/lib/client-auth.ts` | New | Cookie + PIN + rate-limit module |
| `src/app/client/login/page.tsx` | New | Login page |
| `src/app/t/[slug]`, `src/app/c/[slug]` | Modified | Header login icon only (no gating) |
| `src/lib/mock-data.ts` | Modified | Mock PIN mirror |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Short PIN brute-force | Med | Per-email rate limiting |
| Plaintext PIN leakage | Low | bcrypt hash; never log/render |
| Mock/Supabase drift | Med | Update mock + data layer together |
| Clients without PIN | Med | `NULL` = unset; agent must set it |

## Rollback Plan

Remove the login page/icon and `src/lib/client-auth.ts`, then revert the migration (drop `clients.pin_hash`). No page was gated, so public viewing is unaffected throughout.

## Dependencies

- Fix missing `AccountRole` type import in `src/middleware.ts`.

## Success Criteria

- [ ] Agent sets/rotates a client PIN; stored bcrypt-hashed, never plaintext.
- [ ] `/client/login` accepts email + PIN, issues a signed `HttpOnly` cookie, rejects wrong credentials.
- [ ] `/t/{slug}` and `/c/{slug}` remain viewable without a session (unchanged behavior).
- [ ] Mock mode mirrors behavior without Supabase.
- [ ] Typecheck, lint, unit, and e2e suites pass.
