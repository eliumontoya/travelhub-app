# Delta for Trip Itinerary

## MODIFIED Requirements

### Requirement: Trip creation and assignment

The system MUST let the agent create trips with title, date range, instructions, one or more clients, optional new client creation, optional template source, traveler count, status, currency, tags, and an optional assigned travel agent (`assigned_agent_id`). The system MUST also let the agent edit an existing trip to change its assigned agent. The assigned agent is nullable; a trip without an assigned agent is valid.

(Previously: Trip creation included title, date range, instructions, clients, template source, traveler count, status, currency, and tags — but no assigned-agent field.)

#### Scenario: Create trip for existing clients

- GIVEN one or more clients exist
- WHEN the agent creates a trip with title, dates, and selected clients
- THEN the system MUST create the trip and redirect to its editor

#### Scenario: Block trip without clients

- GIVEN the agent submits a new trip without any selected client
- WHEN the request is processed
- THEN the system MUST reject it with a validation error

#### Scenario: Create trip with assigned agent

- GIVEN at least one travel agent exists
- WHEN the agent creates a trip and selects a travel agent
- THEN the trip MUST persist with `assigned_agent_id` set to that agent

#### Scenario: Edit trip to assign or change agent

- GIVEN an existing trip (with or without an assigned agent)
- WHEN the agent changes the assigned-agent selection in the editor
- THEN the trip's `assigned_agent_id` MUST update to the new selection or become null if cleared

#### Scenario: Create trip without assigned agent

- GIVEN the agent creates a trip without selecting a travel agent
- WHEN the trip is persisted
- THEN `assigned_agent_id` MUST be null and the trip MUST be valid
