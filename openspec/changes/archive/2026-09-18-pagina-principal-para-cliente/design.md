# Design: Client Home Page (`pagina-principal-para-cliente`)

## Technical Approach

Authenticated, session-gated Server Component at `/client` that verifies the existing client session (issue #302), then reads the client's own profile and trips through **service-role-backed** helpers behind the `src/lib/data.ts` boundary. A whitelist view model (`ClientHomeTrip`) guarantees agent-only fields (`commissionRate`, `internalNotes`) never reach the client, while `salePrice` and the assigned agent remain visible. No middleware, RLS migration, or `/t/{slug}`/`/c/{slug}` change.

## Data Flow

```
Login form ──clientSignIn──> verifyClientCredentials (HMAC PIN) ──> issueClientSession ──> redirect /client
    /client page (Server Component):
        getClientSession() ── null/invalid ──> redirect /client/login?redirectTo=/client
        ── ok ──> getClientProfileForHome(id) ──> ClientProfileForHome
              └──> getClientHomeTrips(id) ──> trip_clients → trips(draft|published) → ClientHomeTrip[]
    logout form ──clientLogout──> destroyClientSession ──> redirect /client/login?status=loggedOut
```

## Architecture Decisions

| Decision | Choice | Tradeoff | Rationale |
|---|---|---|---|
| Gate | Server Component calls `getClientSession()` | Middleware vs in-page gate | Matches `c/[slug]` pattern; middleware matcher is `/dashboard`-only |
| Read role | `getSupabaseAdmin()` (service role) | anon RLS can't read client's own row | Proposal requires it; login already uses service role for PIN |
| View model | Whitelist `Pick` types | `Omit` could leak future fields | Risk table mandates "field absent" assertions |
| Degradation | Return `null`/`[]` when key missing | throw vs empty | `config.yaml` rule: external integrations degrade gracefully |
| Logout | Reuse `clientLogout` action | new action | Already destroys session + redirects |
| Login redirect | Default `redirectTo` → `/client` | keep success page | Proposal: post-login targets `/client` |

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/client/page.tsx` | Create | Gated home: profile + filtered trip list + logout button |
| `src/app/client/login/actions.ts` | Modify | `clientSignIn` fallback redirect → `/client` |
| `src/app/client/login/page.tsx` | Modify | Hidden `redirectTo` default → `/client` (form always submits it, so actions.ts fallback never fires otherwise) |
| `src/lib/data/clients.ts` | Modify | Add `getClientProfileForHome(clientId)` |
| `src/lib/data/trips.ts` | Modify | Add `getClientHomeTrips(clientId)` (via `trip_clients`) |
| `src/types/index.ts` | Modify | Add `ClientHomeTrip` + `ClientProfileForHome` |
| `src/lib/__tests__/client-home-data.test.ts` | Create | Unit tests for both helpers (mock + degrade) |
| `src/app/client/__tests__/page.test.tsx` | Create | Page gating/render/link tests |

## Interfaces / Contracts

```ts
// src/types/index.ts — whitelist: OMITS commissionRate, internalNotes, budget,
// reminderSentAt, isTemplate, clientId, createdAt, updatedAt, showCostsToClient.
export interface ClientHomeTrip {
  id: string;
  title: string;
  slug: string;
  startDate: string;
  endDate: string;
  coverImageUrl?: string;
  status: TripStatus;          // only draft|published survive filtering
  currency: TripCurrency;
  travelerCount: number;
  salePrice?: number;          // KEPT — client sees own price
  assignedAgentId?: string;    // KEPT — resolved from travel_agents
  assignedAgentName?: string;
}

export type ClientProfileForHome = Pick<Client,
  "name" | "email" | "phone" | "whatsapp" | "birthDate" |
  "notes" | "referralSource" | "coverImageUrl">;
```

```ts
// Shared branch helper (in data/shared.ts)
export function canUseServiceRole(): boolean {
  return isSupabaseConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
```

Both helpers branch: `!isSupabaseConfigured()` → mock; configured-but-no-service-role → degrade (`null`/`[]`); else `getSupabaseAdmin()`. `getClientHomeTrips` reads `trip_clients` for `trip_id`s, filters `trips` to `status in (draft, published)`, then batch-resolves agent names via `travel_agents.in()`.

## Data Layer Integration

Helpers live in `clients.ts`/`trips.ts` and are re-exported through `src/lib/data.ts` (`export *`). Pages never import the DB client directly — the page calls only `getClientSession()` (auth) and the two data helpers.

## Session / Auth Flow

`getClientSession()` reads the HMAC-signed `th-client-session` cookie (tamper/expiry → `null`). Page redirects when `null`. Logout posts to the existing `clientLogout` server action (`destroyClientSession()` + redirect). No change to `client-auth.ts`.

## Degradation

- **Service role key missing (Supabase configured):** helpers return `null`/`[]`; page renders "no hay viajes" / profile placeholder instead of a 500. (Login itself still requires the key via `getClientPinHashByEmail` — pre-existing.)
- **Session secret missing:** `CLIENT_SESSION_SECRET` falls back to `DEV_FALLBACK_SECRET` (existing); prod must set it — documented, not code-changed.

## Testing Strategy (strict TDD)

| Layer | What | Approach |
|---|---|---|
| Unit (Vitest) | `getClientProfileForHome` whitelist | mock-mode `c1`; assert profile fields present, `id`/`slug`/`createdAt` absent |
| Unit | `getClientHomeTrips` | mock mode: returns `draft`+`published`, excludes `archived`; `salePrice`+agent present |
| Unit | Field-leak guard | assert `!("commissionRate" in t)` and `!("internalNotes" in t)` |
| Unit | Degradation | mock `isSupabaseConfigured:true`, no service key → `null`/`[]` |
| Unit (page) | gating + links | mock `getClientSession`/helpers/`redirect`; no session → redirect; draft trip renders no `/t/` link; published renders link |
| Unit | login redirect | update `actions.test.ts`: default redirect `/client` |
| E2E (Playwright) | full flow | login → `/client` → sees trips → logout → login (mock mode) |

Mock-mode cookie setup reuses `createMockCookieStore()` from `src/lib/__tests__/client-auth.test.ts` (mocks `next/headers` `cookies`).

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration. Rollback: revert `login` redirect defaults, delete page + helpers + `ClientHomeTrip`.

## Open Questions

None.
