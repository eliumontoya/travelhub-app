# Exploration: Traveler-created trip activities

## Current State

- `/t/[slug]` renders published trips without login; its only mutation is feedback. A client PIN session exists (`getClientSession()`), but the header login control does not gate the page.
- `items` has no creator/owner field. The generic `createItem`, `updateItem`, and soft-delete `deleteItem` functions serve the agent editor. Agent Server Actions reject itinerary edits while a trip is published.
- Public Supabase access is read-only for published trips, days, and items. `trip_clients` is private and is the authoritative many-to-many assignment; `trips.client_id` is only a compatibility mirror.

## Affected Areas

- `src/app/t/[slug]/page.tsx`, `actions.ts` — render traveler controls and accept mutations only for an eligible published trip.
- `src/lib/client-auth.ts` — resolve the signed client session for traveler actions.
- `src/lib/data/trips.ts`, `src/lib/data.ts`, `src/types/index.ts`, `src/lib/mock-data.ts` — persist creator identity, map it on reads, and implement scoped traveler mutations in both data modes.
- `supabase/migrations/` — add durable creator attribution and indexes/constraints as appropriate without granting broad anonymous item writes.
- `openspec/specs/public-trip-sharing/spec.md`, `openspec/specs/trip-itinerary/spec.md`, `openspec/specs/client-auth/spec.md` — define creation, ownership, lifecycle, and authentication behavior.
- Focused unit/integration tests — cover cross-client, agent-item, day/trip mismatch, unpublished-trip, and forged action input cases.

## Approaches

1. **Server-authorized traveler actions on shared items** — attribute each traveler-created item to a client; validate session, published status, `trip_clients` assignment, day membership, and item ownership on every mutation. Use a narrow data-layer operation and keep public reads unchanged.
   - Pros: Reuses itinerary rendering and item model; preserves existing public read-only RLS posture; works with the new PIN session.
   - Cons: Requires a migration and carefully scoped server-side privileged access or equivalent database function; must avoid check-then-write races.
   - Effort: Medium.
2. **Separate traveler-activity table** — store traveler additions separately and merge them into the public itinerary.
   - Pros: Harder to confuse agent and traveler item ownership.
   - Cons: Duplicates item schema/rendering and complicates sorting, calendar export, and dashboard visibility.
   - Effort: High.

## Recommendation

Use approach 1. Keep anonymous itinerary viewing, but require a valid client PIN session for mutations and verify that the client is assigned to the trip via `trip_clients`. Persist `created_by_client_id` (null for existing/agent items) and expose edit/delete controls only for matching traveler items. Recheck ownership and trip/day/published predicates server-side on every action; UI hiding alone is not authorization. Do not reuse agent editing actions because they intentionally reject published trips. The proposal should define a bounded activity form and whether agent editing of traveler-created items remains subject to the existing published-trip lock.

## Risks

- A public slug or valid session alone does not prove that a client belongs to a shared trip; `trip_clients` must be checked privately.
- Anonymous Supabase clients cannot currently write items or read `trip_clients`; widening RLS without a client identity recognized by Supabase would be unsafe.
- Publishing may later be reversed; mutations must stop immediately when the trip is no longer published, including draft previews.
- Existing items need null ownership backfill semantics, and mock mode must enforce the same rules as Supabase.

## Ready for Proposal

Yes. Confirm product boundaries for eligible clients, allowed activity fields, and whether traveler-created items remain visible/editable when a trip is returned to draft or archived.
