# MCP Trip-Day Tools Specification

## Purpose

Expose TravelHub's trip-day domain to an external agent through the MCP server. The tools let an agent add, update, delete, restore, generate, and reorder the days of a trip itinerary.

## Requirements

### Requirement: Direct data-layer access under the service-role gate

Each tool MUST invoke the TravelHub data layer directly and MUST NOT pass an injected Supabase client or rely on any request-scoped client store. The MCP route's service-role gate MUST prevent any trip-day tool from executing when the service role is absent, so no trip-day tool MUST operate against in-memory mock data.

#### Scenario: Mock data never reachable

- GIVEN the Supabase service role is not configured
- WHEN the agent invokes any trip-day tool
- THEN the request is rejected with HTTP 503 before the tool executes
- AND no mock-data read or mutation occurs

### Requirement: Structured success/error envelope

Trip-day tool results MUST use a structured success/error envelope. Successful object payloads MUST be returned as a JSON-encoded text content block. Not-found failures MUST surface `NOT_FOUND: trip day <id>` with `isError: true`. Unexpected failures MUST return a sanitized message and MUST NOT expose stack traces, database identifiers, or service-role credentials.

#### Scenario: Not-found result names the resource and id

- GIVEN an `update_trip_day` call for a trip-day id that does not exist
- WHEN the server returns the result
- THEN the result has `isError: true`
- AND the message is `NOT_FOUND: trip day <id>` where `<id>` is the caller-supplied id

### Requirement: Add a trip day

The `add_trip_day` tool MUST create a trip day for the caller-supplied trip from its `date`, `notes`, and `sortOrder` inputs, and MUST return the created trip day including its id.

#### Scenario: Add a trip day

- GIVEN an existing trip
- WHEN the agent calls `add_trip_day` with the trip's id and a date
- THEN a trip day is created and the result contains the new day with its id

### Requirement: Update a trip day

The `update_trip_day` tool MUST update an existing trip day from the caller-supplied partial fields, returning the updated trip day. When the trip day does not exist, the tool MUST return `NOT_FOUND: trip day <id>`.

#### Scenario: Update a trip day

- GIVEN a trip day with a known id
- WHEN the agent calls `update_trip_day` with that id and changed fields
- THEN the trip day is updated and the result contains the updated day

#### Scenario: Update a missing trip day

- GIVEN no trip day with the caller-supplied id
- WHEN the agent calls `update_trip_day` with that id
- THEN the result is `NOT_FOUND: trip day <id>` with `isError: true`

### Requirement: Delete a trip day

The `delete_trip_day` tool MUST delete the trip day matching the caller-supplied id.

#### Scenario: Delete a trip day

- GIVEN a trip day with a known id
- WHEN the agent calls `delete_trip_day` with that id
- THEN the trip day is deleted

### Requirement: Restore a trip day

The `restore_trip_day` tool MUST restore a previously deleted trip day identified by the caller-supplied id.

#### Scenario: Restore a trip day

- GIVEN a trip day that was deleted
- WHEN the agent calls `restore_trip_day` with that id
- THEN the trip day is restored

### Requirement: Generate trip days

The `generate_trip_days` tool MUST generate the day structure for the caller-supplied trip (for example, from the trip's date range) and MUST return a result describing the generated days.

#### Scenario: Generate trip days

- GIVEN an existing trip with a start and end date
- WHEN the agent calls `generate_trip_days` with the trip's id
- THEN day rows are generated for the trip
- AND the result reports the generation outcome

### Requirement: Reorder trip days

The `reorder_trip_days` tool MUST apply the caller-supplied ordering (a list of `{ id, sortOrder }` entries) to the trip days.

#### Scenario: Reorder trip days

- GIVEN multiple trip days
- WHEN the agent calls `reorder_trip_days` with a new ordering
- THEN the trip days are persisted in the supplied order
