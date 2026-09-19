# Delta for Client Authentication

## ADDED Requirements

### Requirement: PIN session required for traveler mutations

Traveler activity writes MUST require a valid, unexpired PIN session and assignment to the target trip. This MUST NOT be required for anonymous published-trip viewing.

#### Scenario: Assigned authenticated traveler may mutate

- GIVEN a client has a valid PIN session and a private assignment to a published trip
- WHEN the client submits an allowed activity mutation
- THEN the mutation MAY proceed subject to day and ownership checks

#### Scenario: Missing or invalid session is rejected

- GIVEN a client has no session or presents a tampered or expired session
- WHEN the client submits an activity mutation
- THEN the mutation MUST be rejected without persistence

#### Scenario: Viewing remains unauthenticated

- GIVEN a trip is published
- WHEN an anonymous user opens `/t/{slug}`
- THEN the itinerary MUST render without a client session
