# Proposal: Client Home Page

## Intent

Clients can log in (issue #302 / PR #305) but land on a bare success state. Give each authenticated client a home page: read-only profile, their trips with status, and a public link only for published trips. Closes issue #307.

## Scope

### In Scope

- New authenticated `/client` page (`src/app/client/page.tsx`) that verifies the client session and redirects unauthenticated visitors to `/client/login`.
- Read-only profile: `name`, `email`, `phone`, `whatsapp`, `birthDate`, `notes`, `referralSource`, `coverImageUrl`.
- Logout action on the home page that destroys the client session.
- Trip list via `trip_clients` (source of truth) showing `draft` and `published` status only (`archived` trips are hidden); `/t/{slug}` link only for `published`.
- Server-only service-role read helpers in `src/lib/data/clients.ts` and `src/lib/data/trips.ts` that strip agent-only fields `commissionRate` and `internalNotes` (the client may still see `salePrice` and their assigned agent).
- Login success redirect → `/client`. Spanish (Rioplatense) UI copy. Unit tests (strict TDD).

### Out of Scope

- Client editing of any data (read-only).
- RLS migration / token redesign (Approach 2).
- Changing public `/c/{slug}` semantics.
- Listing `archived` trips (filtered out of the client home list).

## Capabilities

### New Capabilities

- `client-home`: authenticated client landing — read-only profile, own trip list with status, public links for published trips only.

### Modified Capabilities

- `client-auth`: post-login redirect targets `/client`.

## Approach

Exploration **Approach 1**. `src/app/client/page.tsx` (Server Component) calls `getClientSession()`; missing/invalid session → `/client/login?redirectTo=/client`. On success, call new service-role helpers (`getClientProfileForHome`, `getClientHomeTrips`) through the `src/lib/data.ts` boundary — never a direct DB call. Helpers use `getSupabaseAdmin` (anon RLS cannot read a client's own row) and map to an explicit `ClientHomeTrip` view model omitting `commissionRate` and `internalNotes`. The page renders a read-only profile, a logout action (destroy session), and the client's `draft`/`published` trips (`archived` filtered out) with links only for published trips.

## Affected Areas

- `src/app/client/page.tsx` — new session-gated client home (profile, logout, filtered trip list).
- `src/app/client/login/actions.ts` — redirect → `/client`.
- `src/lib/data/clients.ts` — add `getClientProfileForHome`.
- `src/lib/data/trips.ts` — add `getClientHomeTrips` via `trip_clients`, strips agent-only fields.
- `src/types/index.ts` — add `ClientHomeTrip` view model.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Agent-only trip field leakage (`commissionRate`, `internalNotes`) | Med | Whitelist mapping + test asserts those fields absent |
| Service-role key missing | Med | Degrade gracefully, consistent with PIN features |
| Session secret unset | Low | Reuse `getClientSession`; document prod secret |
| M2M trip missed | Low | Read via `trip_clients` |

## Rollback Plan

No migration/schema change. Code revert: restore `login/actions.ts` redirect, delete `src/app/client/page.tsx`, the two data helpers, and `ClientHomeTrip`. `/c/{slug}` and `/t/{slug}` are untouched.

## Dependencies

- `client-auth` (`getClientSession`) already shipped.
- `SUPABASE_SERVICE_ROLE_KEY` (required for PIN features).

## Success Criteria

- [ ] Authenticated client at `/client` sees name, read-only profile, and trips.
- [ ] Unauthenticated visitor → `/client/login`.
- [ ] Only `published` trips render `/t/{slug}` links; `archived` trips are hidden.
- [ ] Logout action destroys the client session and returns to login.
- [ ] `commissionRate` and `internalNotes` never reach the client view.
- [ ] `tsc --noEmit`, `lint`, `test` pass; login → `/client` verified.

## Open Questions

_Resolved: include a logout action on the home page; hide (filter out) `archived` trips._
