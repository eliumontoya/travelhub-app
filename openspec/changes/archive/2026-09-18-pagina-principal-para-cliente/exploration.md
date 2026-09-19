## Exploration: pagina-principal-para-cliente

### Current State
- Client authentication was delivered in issue #302 / PR #305. It uses a custom signed HttpOnly cookie `th-client-session` managed by `src/lib/client-auth.ts`: `getClientSession()`, `issueClientSession()`, `destroyClientSession()`. Login happens at `/client/login` via `src/app/client/login/actions.ts` (email + PIN verified against `clients.pin_hash`, with rate-limiting via `client_login_attempts`). The session carries only `clientId` and `expiresAt`; there is no Supabase Auth session for clients.
- `src/middleware.ts` only protects `/dashboard/**`; `/client/**`, `/c/{slug}`, and `/t/{slug}` are outside middleware auth. The client session cookie is not visible to Supabase RLS, so any data access for an authenticated client view must be performed server-side with explicit session verification.
- The `Client` type in `src/types/index.ts` and the `rowToClient` mapper in `src/lib/data/clients.ts` expose: `id`, `name`, `slug`, `email`, `phone`, `whatsapp`, `notes`, `referralSource`, `birthDate`, `coverImageUrl`, `createdAt`, `updatedAt`. The `pin_hash` DB column is never mapped to the type.
- Existing client-facing routes:
  - `/client/login` — login form (Spanish UI copy).
  - `/c/{slug}` — public, read-only published-trip history for a client slug; uses `getClientPublishedTripsBySlug` and only exposes `name`, `slug`, `coverImageUrl` plus published trips.
  - `/dashboard/clients/[id]` — agent-only editable client detail page; shows all client fields and allows editing.
- Trips are associated to clients through a many-to-many `trip_clients` table (source of truth), with `trips.client_id` kept as a compatibility mirror for the first assigned client. Trip status is `TripStatus = "draft" | "published" | "archived"`. The public trip URL is `/t/{slug}`; only published trips are readable by anonymous users under RLS.
- In Supabase mode, `getClientById` and `getTripsByClientId` use `createServerSupabase`, which runs as `anon` on client routes because there is no Supabase Auth cookie. They would be blocked by RLS for a logged-in client. The codebase already uses `getSupabaseAdmin` for server-side-only reads that bypass RLS (e.g., PIN hash lookup and PIN updates in `src/lib/data/clients.ts`).

### Affected Areas
- `src/app/client/page.tsx` (new) — authenticated client home/landing page after login; must call `getClientSession()`, redirect to `/client/login` if missing, and render read-only profile + trip list.
- `src/app/client/login/actions.ts` — default redirect currently lands on `/client/login?status=success`; it should likely redirect to `/client` after successful login so the new home page is reachable.
- `src/lib/data/clients.ts` — add a server-only, session-backed read function (e.g., `getClientProfileForHome`) that returns a client’s own read-only profile. In Supabase mode it must use `getSupabaseAdmin` because anonymous RLS does not grant a client access to its own row.
- `src/lib/data/trips.ts` — add a server-only function (e.g., `getClientHomeTrips`) that returns all trips for a given `clientId` via `trip_clients`. It must also bypass RLS via service role and strip agent-only fields (`salePrice`, `commissionRate`, `assignedAgentId`, `internalNotes`) before returning data to the UI.
- `src/types/index.ts` (possible) — introduce a read-only view model such as `ClientHomeTrip` to make the public/private field boundary explicit.
- Tests — under strict TDD, add unit tests for the new data helpers and the page component (mock-mode cookie setup, missing session, valid session, unpublished trip without public link) and optionally a Playwright spec for the login → home flow.
- UI copy — Spanish (Rioplatense) labels for status (`Borrador`/`Publicado`/`Archivado`), section titles, empty states, and link text, consistent with `/c/[slug]` and `/client/login`.

### Approaches
1. **Service-role data functions + dedicated `/client` page**
   - Description: Verify the custom client cookie in a new Server Component at `/client/page.tsx`. On success, call new service-role-backed helpers (`getClientProfileForHome`, `getClientHomeTrips`) that read the client row and `trip_clients`/`trips`, then return a sanitized view model. Published trips render a link to `/t/{trip.slug}`; unpublished trips show status without a link.
   - Pros: Aligns with the existing PIN/server-role pattern in `clients.ts`; no RLS migration needed; keeps agent-only fields out of the client view by explicit mapping; works in both mock and Supabase modes.
   - Cons: Requires `SUPABASE_SERVICE_ROLE_KEY` (already required for PIN features); any future field added to `Trip` must be consciously included/excluded from the client view model to avoid leaking agent data.
   - Effort: Medium

2. **RLS-only with a client token claim**
   - Description: Add a migration that stores a per-client secret/token and exposes an RLS policy allowing `anon` to read its own `clients` row and related trips when the token is presented. The page would still verify the custom cookie and forward the token.
   - Pros: RLS remains the single source of truth; service role is not used for page rendering.
   - Cons: Significantly more complex; requires a migration, a way to map the custom cookie to a Postgres-visible claim, and changes to the Supabase client initialization for client routes. The current custom cookie is not a JWT and cannot be passed as a Supabase user claim without redesigning auth.
   - Effort: High

3. **Reuse `/c/{slug}` with a session gate**
   - Description: Keep the existing public history page but require the client session for it, and extend `getClientPublishedTripsBySlug` to also return unpublished trips for the authenticated owner.
   - Pros: Reuses existing page shape and URL convention.
   - Cons: `/c/{slug}` is intentionally public and indexed by slug; mixing private authenticated data into it breaks the established semantics and makes login redirects awkward. It also leaks the slug-based discovery model for private trips.
   - Effort: Low/Medium

### Recommendation
Use **Approach 1**: create `src/app/client/page.tsx` as the authenticated client home, and add service-role-backed read helpers in `src/lib/data/clients.ts` and `src/lib/data/trips.ts` (or a thin orchestrator in `clients.ts`). This matches the architecture already established for client PIN management, avoids RLS migration complexity, and keeps the public `/c/{slug}` route unchanged. The page should:
1. Redirect unauthenticated visitors to `/client/login?redirectTo=/client`.
2. Display the client’s `name`, `email`, `phone`, `whatsapp`, `birthDate`, `notes`, `referralSource`, and `coverImageUrl` read-only.
3. List all associated trips via `trip_clients` with their `draft`/`published`/`archived` status.
4. Render `/t/{slug}` links only for `published` trips.

### Risks
- **Data leakage of agent-only trip fields**: `rowToTrip` includes `salePrice`, `commissionRate`, `assignedAgentId`, and `internalNotes` can appear on `TripWithDetails`. The new client-home helpers must explicitly omit these fields.
- **Service-role dependency in production**: The client home will fail at runtime if `SUPABASE_SERVICE_ROLE_KEY` is missing. This is already true for PIN login, but it must be documented for deployment.
- **Session/cookie trust boundary**: The custom `th-client-session` cookie is signed with `CLIENT_SESSION_SECRET` (or a dev fallback). The home page relies entirely on this verification; the secret must be set in production.
- **Many-to-many client/trip edge cases**: A trip assigned to multiple clients must appear in each client’s home. Using `trip_clients` (not `trips.client_id`) is required.
- **Test coverage under strict TDD**: Mock-mode tests must be written for the new data helpers and page, including session cookie setup and negative cases (no session, invalid session, unpublished trip without link).

### Ready for Proposal
Yes. The exploration has identified the existing client session, the data-layer constraints, and a clear implementation path. The orchestrator can proceed to `sdd-propose`.
