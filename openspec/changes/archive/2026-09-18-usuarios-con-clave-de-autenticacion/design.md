# Design: Client PIN Authentication (issue #302)

## Technical Approach

Approach A: per-client PIN + custom signed session cookie, additive only. Add nullable `clients.pin_hash` (bcrypt) and a `/client/login` page issuing an `HttpOnly` signed cookie. A new `src/lib/client-auth.ts` owns cookie sign/verify/destroy, PIN verify, and per-email rate limiting. **Public pages stay unauthenticated** — the session is infrastructure for future gating; public pages only render a login/logout icon.

## Architecture Decisions

### Decision: PIN hashing
- **Choice**: `bcryptjs` (pure-JS bcrypt); `pin_hash text` nullable; compare via `bcrypt.compare`.
- **Alternatives**: native `bcrypt` (native-binding risk on serverless); `scrypt`/`pbkdf2` (no new dep, but scope says bcrypt).
- **Rationale**: pure JS runs anywhere server actions run; no native build.

### Decision: Session cookie signing & secret source
- **Choice**: HMAC-SHA256 via `node:crypto` (`createHmac` + `timingSafeEqual`), matching `src/lib/whatsapp/signature.ts`. Cookie `th-client-session` = `${clientId}.${expiresAt}.${signature}`; `HttpOnly`, `SameSite=Lax`, `path=/`, `secure` in prod, ~30-day `maxAge`. Secret from `CLIENT_SESSION_SECRET`; dev fallback constant.
- **Alternatives**: JWT (extra dep + surface); session table (stateful).
- **Rationale**: stateless, self-verifying, zero deps, constant-time compare already in-repo.

### Decision: Session verify helper location & sharing
- **Choice**: pure functions in `src/lib/client-auth.ts` — `getClientSession()`, `issueClientSession(clientId)`, `destroyClientSession()`. Shared by the login action (writes) and public pages (read-only icon). No DB round-trip on verify.
- **Rationale**: one audited module; future gating imports the same helper.

### Decision: `pin_hash` never leaves the data layer
- **Choice**: `Client` type gains **no** `pin` field; `rowToClient` unchanged. PIN read/written only via `getClientPinHashByEmail(email)` / `setClientPin(id, plaintext)` / `hasClientPin(id)` in `clients.ts`, using `getSupabaseAdmin()` (service role).
- **Rationale**: anon RLS grants only `id/slug/name` (0019); credential check is server-side, so service role is correct and never exposed.

### Decision: Per-email rate limiting storage
- **Choice**: dual-mode store behind one interface in `client-auth.ts`. Supabase: `client_login_attempts` table (`email` PK, `failures`, `window_started_at`, `updated_at`) via service role. Mock: in-memory `Map` in `mock-data.ts`. Sliding window; success resets; ~5 fails / 15 min.
- **Alternatives**: in-memory only (lost on restart/multi-instance); table always (forces Supabase in mock).
- **Rationale**: durable where it matters, no Supabase Auth in mock.

### Decision: Mock-mode parity without Supabase Auth
- **Choice**: mock stores bcrypt hashes in `mockClientPinHashes: Map<clientId, string>` and verifies with the same `bcrypt.compare`; mock rate limiting uses the in-memory map. No Supabase Auth anywhere.
- **Rationale**: true parity — both modes hash with bcrypt and share the verify/compare path, eliminating drift.

## Data Flow

```
login form ──→ clientSignIn (server action)
                ├─ rateLimit.check(email)
                ├─ getClientByEmail + getClientPinHashByEmail (service role)
                ├─ bcrypt.compare(pin, hash)
                └─ issueClientSession(clientId) ──→ Set-Cookie (HttpOnly)
public page ──→ getClientSession() ──→ {clientId}|null ──→ icon only (no gating)
logout ──→ destroyClientSession() ──→ clear cookie
agent form ──→ setClientPin(id, pin) ──→ bcrypt.hash → pin_hash
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/20260916000000_client_pin_hash.sql` | Create | `clients.pin_hash text` nullable; no RLS change |
| `supabase/migrations/20260916010000_client_login_attempts.sql` | Create | `client_login_attempts` (RLS on, no anon policies) |
| `src/types/index.ts` | Modify | add `ClientSession` type (no `pin_hash` on `Client`) |
| `src/lib/data/clients.ts` | Modify | `setClientPin`, `getClientPinHashByEmail`, `hasClientPin` (dual-mode) |
| `src/lib/client-auth.ts` | Create | cookie issue/verify/destroy, PIN verify, rate-limit interface |
| `src/lib/mock-data.ts` | Modify | `mockClientPinHashes`, `mockClientLoginAttempts` |
| `src/app/client/login/page.tsx` + `actions.ts` | Create | login UI; `clientSignIn`/`clientLogout` |
| `src/components/ClientSessionButton.tsx` | Create | login/logout icon (no gating) |
| `src/app/t/[slug]/page.tsx`, `src/app/c/[slug]/page.tsx` | Modify | render icon near `ThemeToggle` (additive) |
| `src/app/dashboard/clients/[id]/*` | Modify | PIN set/rotate field + action |

## Interfaces / Contracts

```ts
export type ClientSession = { clientId: string; expiresAt: number };

// client-auth.ts
getClientSession(): Promise<ClientSession | null>;
issueClientSession(clientId: string): Promise<void>;
destroyClientSession(): Promise<void>;
verifyClientCredentials(email: string, pin: string):
  Promise<{ ok: true; clientId: string } | { ok: false; reason: "invalid" | "rate_limited" }>;

// clients.ts — never expose pin_hash via Client
getClientPinHashByEmail(email: string): Promise<string | null>;
setClientPin(clientId: string, pin: string): Promise<void>;
hasClientPin(clientId: string): Promise<boolean>;
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | cookie sign/verify/tamper/expiry; rate-limit window/reset/isolation; bcrypt compare | Vitest `client-auth.test.ts` |
| Unit | `setClientPin`/`getClientPinHashByEmail` mock-mode; `rowToClient` never exposes hash | Vitest `client-pin.test.ts` |
| Integration | Supabase pin persist + verify via service role (when configured) | data-domain-contracts style |
| E2E | login success/failure/rate-limit; public pages render without session | Playwright |

## Threat Matrix

N/A — no routing, shell/subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

Additive only; `pin_hash` nullable, existing clients get `NULL` (cannot log in until the agent sets a PIN). Rollback: drop `client-auth.ts`, login page/icon, and `client_login_attempts`, then `drop column pin_hash`. Public pages unaffected.

## Open Questions

- [ ] Post-login surface: minimal "logged in" confirmation on `/client/login`, or redirect back to referring page? (no gating either way)
- [ ] `AccountRole` import (proposal dependency) — current `middleware.ts` imports only `updateSession`; confirm whether still needed during apply.
- [ ] PIN minimum length/format (e.g. 4–6 digits) enforcement in the agent form.
