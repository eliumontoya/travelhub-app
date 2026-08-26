# Delta Spec: issue-183-traveler-checklist

## MODIFIED Requirements

### Requirement: Public itinerary data access boundaries

The public `/t/{slug}` page MUST assemble traveler itinerary data using only tables and fields that are safe for anonymous access under public RLS policies. It MUST NOT query dashboard-only private relation tables such as `trip_clients`, `trip_tags`, `trip_status_history` during public traveler rendering. Public rendering MUST still include the trip's own `coverImageUrl` when set.

The `packing_items` table SHALL be treated as traveler-safe only for rows whose parent trip is `published`; anonymous users MUST NOT be able to insert, update, delete, or read checklist rows for draft or archived trips.

#### Scenario: Render published trip without private relation reads

- GIVEN a published trip has a `coverImageUrl`
- AND dashboard relation tables such as `trip_clients` deny anonymous access
- WHEN a traveler opens `/t/{slug}`
- THEN the public page MUST render without querying those private relation tables
- AND the top hero MUST use the trip's `coverImageUrl`

#### Scenario: Read checklist for published public trip

- GIVEN a published trip has one or more packing checklist rows
- WHEN a traveler opens `/t/{slug}`
- THEN the public page MAY read `packing_items` rows for that trip
- AND the checklist MUST render in read-only mode below the travel documents section

#### Scenario: Keep non-published checklist rows private

- GIVEN a trip is draft or archived
- WHEN an anonymous user attempts to read its checklist rows
- THEN `packing_items` RLS MUST deny access to those rows
- AND anonymous users MUST NOT be granted insert, update, or delete access to `packing_items`

## ADDED Requirements

No new requirement groups; this change restores the existing public checklist requirement by refining the public data boundary.

## REMOVED Requirements

No requirements removed.
