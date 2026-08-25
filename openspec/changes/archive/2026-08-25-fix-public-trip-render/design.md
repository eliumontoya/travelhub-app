# Design: Public Trip Render Must Avoid Private Relation Reads

## Context

`getTripWithDetails(slug)` is used by `/t/[slug]`, a public route rendered with Supabase anon permissions. Before this fix, it reused `assembleTripWithDetails`, which is also used by the authenticated dashboard and reads private relation tables.

Those private tables are intentionally not public:

- `trip_clients` stores all assigned clients.
- `trip_tags` stores internal categorization.
- `trip_status_history` is operational history.

The public route does not need these private relations to render the itinerary hero, days, items, documents, and photos.

## Decision

Create a dedicated `assemblePublicTripWithDetails` helper and call it from `getTripWithDetails(slug)`. Keep the existing `assembleTripWithDetails` unchanged for dashboard/internal usage.

## Public Assembler Behavior

`assemblePublicTripWithDetails` reads:

- `trips` via the existing explicit public column list in `getTripWithDetails`
- `trip_photos`
- `trip_days`
- `items`
- `documents`
- `suppliers` display fields
- `trip_documents`

It returns empty arrays/defaults for dashboard-only fields required by the `TripWithDetails` type:

- `clients: []`
- `client: {} as Client`
- `tags: []`
- `statusHistory: []`
- `packingItems: []`

## Rationale

This preserves the public security boundary instead of widening database policies. It also avoids exposing assigned-client relationships and internal operational metadata to anonymous users.

## Verification Strategy

- Unit regression test mocks Supabase and fails if public trip assembly queries `trip_clients` or `packing_items`.
- Full test suite and production build validate no TypeScript/runtime integration regressions.

## Warning: Packing Checklist Follow-Up

The public specification currently includes packing checklist visibility, but the live `packing_items` table denies anon. PR #158 prioritized restoring the public traveler page and cover hero without broadening RLS. A follow-up should either add a narrow published-trip public read policy for `packing_items` or revise the checklist feature boundary.
