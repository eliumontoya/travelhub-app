# Delta for WhatsApp Inbound Automation

## MODIFIED Requirements

### Requirement: Trip-scoped tool ownership guard
Every trip-scoped TravelHub data tool MUST verify that the requested trip belongs to the client resolved from the inbound WhatsApp phone before returning trip details. It MUST also verify that the trip is published before exposing trip summary, itinerary, document, or other trip detail data. When an owned trip is not published, the tool MUST return only a generic planning-safe message indicating that the trip is still being planned by an agent and that more information will be available once it is published.
(Previously: trip-scoped tools only required ownership validation before returning safe trip details.)

#### Scenario: Owned published trip summary is returned
- GIVEN a resolved client asks about a published trip assigned to that client
- WHEN the trip summary tool runs
- THEN it MUST return only safe trip summary fields.

#### Scenario: Owned unpublished trip only returns planning message
- GIVEN a resolved client asks about a trip assigned to that client
- AND the trip status is not `published`
- WHEN any trip-scoped detail tool runs
- THEN it MUST return only a generic planning-safe message
- AND it MUST NOT return trip title, dates, itinerary items, confirmation codes, document counts, document links, storage paths, or private trip details.

#### Scenario: Non-owned trip is blocked
- GIVEN a resolved client attempts to query a trip id not assigned to that client
- WHEN any trip-scoped tool runs
- THEN the tool MUST return a blocked ownership result
- AND it MUST NOT return trip details.

### Requirement: Dynamic trip ambiguity handling
The system MUST detect when a client has zero, one, or multiple active/recent trips so the agent can answer, ask for clarification, or escalate safely. Active/recent trip choices MUST NOT expose details for trips whose status is not `published`; those choices MAY include only an internal trip id and a generic planning label needed for safe routing.
(Previously: active/recent trip choices could include concise trip metadata regardless of publication status.)

#### Scenario: Multiple active trips require clarification
- GIVEN a resolved client has multiple active or recent trips
- WHEN active trip lookup runs
- THEN the result MUST mark the lookup as ambiguous
- AND include only concise trip choices suitable for asking the customer to clarify.

#### Scenario: Unpublished active trip choice is minimized
- GIVEN a resolved client has an active or recent trip whose status is not `published`
- WHEN active trip lookup runs
- THEN the choice MUST NOT include trip title, slug, start date, or end date
- AND it MUST preserve enough internal identity for the server to route the next trip-scoped tool call.
