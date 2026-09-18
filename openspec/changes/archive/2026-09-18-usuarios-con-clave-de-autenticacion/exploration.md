# Exploration: Client PIN Authentication (issue #302)

## Current State

### Clients table
- Source of truth: `supabase/migrations/0001_init.sql` plus additive migrations.
- Current columns: `id`, `name`, `email`, `phone`, `notes`, `created_at`, `slug` (0019), `birth_date` (0021), `referral_source` (0023), `cover_image_url` (0031), `whatsapp` + `whatsapp_normalized` (20260828015023).
- **No PIN column exists.**

### Migration numbering
- Older migrations use 4-digit sequential numbering (`0001_init.sql` → `0041_travel_agents.sql`).
- Recent WhatsApp/CRM migrations use ISO-ish timestamps (`20260826194451_...` → `20260913120000_...`).
- Either convention is acceptable; the latest production-style migrations use timestamps.

### Public trip access today
- `/t/{slug}` (`src/app/t/[slug]/page.tsx`) calls `getTripWithDetails(slug)` and gates rendering through `isTravelerTripVisible(status, tripId, previewToken)` (`src/lib/trip-visibility.ts`).
- Any published trip is visible without authentication; drafts are visible only with a `?preview=<tripId>` token.
- `/c/{slug}` (`src/app/c/[slug]/page.tsx`) calls `getClientPublishedTripsBySlug(slug)` and shows the client's name + published trips, also without authentication.

### Auth model
- Supabase Auth is used for a **single admin/agent** login (`/login`).
- `src/middleware.ts` only protects `/dashboard/**`; public routes have no session requirement.
- `src/app/login/actions.ts` signs in with email + password.
- Mock mode uses `mockProfiles` in `src/lib/mock-data.ts`, but the imported `AccountRole` type from `@/types` is currently missing.

### Data layer
- `src/lib/data.ts` is a pure re-export facade over `src/lib/data/*`.
- `src/lib/data/clients.ts` owns client CRUD and `rowToClient`.
- `src/lib/data/trips.ts` owns trip reads including `getTripWithDetails` and `getClientPublishedTripsBySlug`.
- Dual-mode Supabase/mock is enforced in every public function; mock parity is required for any schema change.

### Public page layout
- No shared header/navbar component exists for public pages.
- `/t/{slug}` has a `ThemeToggle` fixed at top-right; `/c/{slug}` has no chrome.
- A client login icon would be added inline to the public pages (top/right, near `ThemeToggle`).

## Affected Areas

1. **Database**: new migration adding `clients.pin` (hashed) and possibly `clients.pin_set_at`.
2. **Types**: `Client` type in `src/types/index.ts` needs `pin?: string` (or a separate internal field) and a client-session type.
3. **Data layer**: `src/lib/data/clients.ts` (`createClient`, `updateClient`, `rowToClient`, `getClientByEmail`) and new PIN validation helpers.
4. **Trip visibility**: `src/lib/trip-visibility.ts` and the public pages `/t/[slug]`, `/c/[slug]` must check PIN/session before revealing data.
5. **Client auth UI**: new `/client/login` page, login icon on public pages, session cookie handling.
6. **Mock data**: `src/lib/mock-data.ts` must mirror the new column and validation logic.
7. **Middleware**: not strictly required for client routes, but a helper to read the client session cookie will be shared across public pages and login actions.

## Approaches

### Approach A — Per-client PIN with custom session cookie (recommended)
1. Add `clients.pin` (bcrypt-hashed, nullable) via migration.
2. Agent sets/rotates the PIN in the existing client form (`/dashboard/clients/[id]`).
3. New `/client/login` page accepts `email` + `pin`; server action hashes the PIN, looks up the client, and on match issues a signed/`HttpOnly` cookie (e.g., `th-client=<clientId>.<signature>`).
4. `/t/{slug}` and `/c/{slug}` read the cookie, validate the signature, and map it to the associated client before calling `getTripWithDetails` / `getClientPublishedTripsBySlug`.
5. A client may access a trip only if the trip is published **and** the trip's `clients` includes the session client.

**Pros**
- Minimal disruption to the existing single-admin Supabase Auth model.
- Matches the issue wording: each client has its own PIN.
- Works in mock mode with a simple in-memory/cookie mirror.
- No extra Supabase Auth seats or email flows.

**Cons**
- Custom session machinery (cookie signing, rotation, logout) must be built and audited.
- PIN storage must be hashed; brute-force risk on a short numeric PIN requires rate-limiting.
- Multi-client trips need clear semantics (any associated client's PIN grants access to the shared trip).

**Effort**: Medium — mostly data-layer and two public pages plus a small auth module.

### Approach B — Supabase Auth passwordless/OTP per client
1. Create a Supabase Auth user per client email.
2. Add `clients.auth_user_id` (or a join table) linking the `clients` row to `auth.users`.
3. Use Supabase's passwordless/OTP sign-in; clients enter email and receive a magic link/OTP.
4. Public pages read the Supabase session and check that the authenticated user's linked client is associated with the requested trip.

**Pros**
- Uses Supabase's battle-tested session/cookie/refresh infrastructure.
- No custom cookie signing or password hashing.
- Aligns with "authenticated session" wording in the issue.

**Cons**
- Much larger schema/auth change: every client needs an auth user and a linkage column.
- Magic links can be cumbersome on mobile; OTP requires email delivery configuration.
- Breaks the current mono-user Supabase Auth assumption in middleware and tests.
- Mock mode would need a mock Supabase Auth implementation.

**Effort**: High — touches auth, migrations, RLS, middleware, and tests end-to-end.

### Approach C — Single shared agency PIN
One PIN shared across all clients; entering it unlocks any published trip.

**Pros**: Trivial to implement.
**Cons**: Does not satisfy "each user can create their own PIN"; no real per-client authentication.
**Effort**: Low, but rejected on requirement fit.

## Recommendation

Proceed with **Approach A**.

It is the smallest change that satisfies the issue while preserving the existing admin-auth model. The key design points are:
- Store **bcrypt-hashed** PINs; never plaintext.
- Use a signed, `HttpOnly`, `SameSite=Lax` cookie named `th-client-session` scoped to `/`.
- Keep PIN validation in a dedicated `src/lib/client-auth.ts` module used by both public pages and the login action.
- In mock mode, store a plaintext comparison token only in memory and mirror the same helper API.
- For multi-client trips, allow access if the session client is any of the trip's associated clients.

## Risks

| Risk | Mitigation |
|------|------------|
| Short numeric PIN brute-force | Add per-email rate limiting in the login action; consider a minimum PIN length (e.g., 4–6 digits). |
| Plaintext PIN leakage | Hash with bcrypt before storage; never log or render PINs. |
| Mock/Supabase parity drift | Update `mock-data.ts`, `rowToClient`, and all validation helpers together. |
| Trip data leaking before PIN check | Fetch only trip metadata for the gating decision; full trip details are fetched only after the PIN/session is validated. |
| Existing client rows without PIN | Treat `NULL` PIN as "not set"; agent must set it before client login works. Public trips remain viewable only if a session exists or the agent opts into PIN-less viewing. |
| `AccountRole` type missing from `@/types` | Fix the type import in `src/middleware.ts` as a small prerequisite or side-car task. |

## Ready for Proposal

Yes. The scope is clear:
1. Add `clients.pin_hash` (nullable) and update `Client` type / `rowToClient`.
2. Allow agents to set/reset the PIN in the client edit form.
3. Build `src/lib/client-auth.ts` (cookie issue/verify/destroy, PIN verify) with mock parity.
4. Create `/client/login` page and add login icon to `/t/[slug]` and `/c/[slug]`.
5. Gate `/t/[slug]` and `/c/[slug]` behind valid client session + trip association.
6. Add migration and update mock data.
