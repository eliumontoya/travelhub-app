# Delta for Public Trip Sharing

## ADDED Requirements

### Requirement: Public itinerary data access boundaries

The public `/t/{slug}` page MUST assemble traveler itinerary data using only tables and fields that are safe for anonymous access under public RLS policies. It MUST NOT query dashboard-only private relation tables such as `trip_clients`, `trip_tags`, `trip_status_history` during public traveler rendering. Public rendering MUST still include the trip's own `coverImageUrl` when set.

#### Scenario: Render published trip without private relation reads

- GIVEN a published trip has a `coverImageUrl`
- AND dashboard relation tables such as `trip_clients` deny anonymous access
- WHEN a traveler opens `/t/{slug}`
- THEN the public page MUST render without querying those private relation tables
- AND the top hero MUST use the trip's `coverImageUrl`
