# Delta for Trip Itinerary

## ADDED Requirements

### Requirement: Trip cover image — upload and remove (agent)

From the trip editor (`/dashboard/trips/[id]`) the agent SHALL be able to upload and remove a trip cover image. The cover is stored per-trip and written to the trip's own `coverImageUrl`; it is distinct from any client-level cover. An `uploadTripCoverImage` / `removeTripCoverImage` capability exists mirroring the global trip-document pattern. In mock mode (Supabase unconfigured) upload and removal are disabled with a graceful "Configura Supabase" message.

#### Scenario: Agent uploads a trip cover

- GIVEN a configured Supabase trip editor
- WHEN the agent uploads a cover image
- THEN the trip's `coverImageUrl` is set to that image's public URL
- AND the prior cover Storage object is removed when replaced

#### Scenario: Agent removes a trip cover

- GIVEN a trip with an existing cover
- WHEN the agent removes it
- THEN `coverImageUrl` becomes null
- AND the cover Storage object is deleted (no orphan)

#### Scenario: Mock mode degrades gracefully

- GIVEN Supabase is not configured
- WHEN the agent opens the trip editor cover control
- THEN it shows "Configura Supabase para subir la portada." and no upload is attempted
