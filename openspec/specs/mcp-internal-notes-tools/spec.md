# MCP Internal-Notes Tools Specification

## Purpose

Expose TravelHub's agent-only trip internal notes to an external agent through the MCP server. The tools let an agent read and update the private internal notes attached to a trip. These notes MUST never be surfaced through the public traveler or client-history routes.

## Requirements

### Requirement: Direct data-layer access under the service-role gate

Each tool MUST invoke the TravelHub data layer directly and MUST NOT pass an injected Supabase client or rely on any request-scoped client store. The MCP route's service-role gate MUST prevent any internal-notes tool from executing when the service role is absent, so no internal-notes tool MUST operate against in-memory mock data.

#### Scenario: Mock data never reachable

- GIVEN the Supabase service role is not configured
- WHEN the agent invokes any internal-notes tool
- THEN the request is rejected with HTTP 503 before the tool executes
- AND no mock-data read or mutation occurs

### Requirement: Structured success/error envelope

Internal-notes tool results MUST use a structured success/error envelope. Successful object payloads MUST be returned as a JSON-encoded text content block. Not-found failures MUST surface `NOT_FOUND: trip <id>` with `isError: true`. Unexpected failures MUST return a sanitized message and MUST NOT expose stack traces, database identifiers, or service-role credentials.

#### Scenario: Not-found result names the resource and id

- GIVEN a `get_trip_internal_notes` call for a trip id that does not exist
- WHEN the server returns the result
- THEN the result has `isError: true`
- AND the message is `NOT_FOUND: trip <id>` where `<id>` is the caller-supplied id

### Requirement: Get trip internal notes

The `get_trip_internal_notes` tool MUST return the internal notes attached to the caller-supplied trip, or `null` when the trip has no internal notes. When the trip does not exist, the tool MUST return `NOT_FOUND: trip <id>`.

#### Scenario: Get existing notes

- GIVEN a trip with internal notes
- WHEN the agent calls `get_trip_internal_notes` with the trip's id
- THEN the result contains the trip's internal notes

#### Scenario: Trip with no notes

- GIVEN a trip with no internal notes
- WHEN the agent calls `get_trip_internal_notes` with the trip's id
- THEN the result is `null`

#### Scenario: Missing trip

- GIVEN no trip with the caller-supplied id
- WHEN the agent calls `get_trip_internal_notes` with that id
- THEN the result is `NOT_FOUND: trip <id>` with `isError: true`

### Requirement: Update trip internal notes

The `update_trip_internal_notes` tool MUST set the internal notes on the caller-supplied trip to the supplied notes value. When the trip does not exist, the tool MUST return `NOT_FOUND: trip <id>`.

#### Scenario: Update notes

- GIVEN a trip with a known id
- WHEN the agent calls `update_trip_internal_notes` with that id and new notes
- THEN the trip's internal notes are set to the supplied value

#### Scenario: Update a missing trip

- GIVEN no trip with the caller-supplied id
- WHEN the agent calls `update_trip_internal_notes` with that id
- THEN the result is `NOT_FOUND: trip <id>` with `isError: true`
