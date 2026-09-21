# MCP Packing Tools Specification

## Purpose

Expose TravelHub's packing-list domain to an external agent through the MCP server. The tools let an agent add, update, and delete the packing items of a trip's packing list.

## Requirements

### Requirement: Direct data-layer access under the service-role gate

Each tool MUST invoke the TravelHub data layer directly and MUST NOT pass an injected Supabase client or rely on any request-scoped client store. The MCP route's service-role gate MUST prevent any packing tool from executing when the service role is absent, so no packing tool MUST operate against in-memory mock data.

#### Scenario: Mock data never reachable

- GIVEN the Supabase service role is not configured
- WHEN the agent invokes any packing tool
- THEN the request is rejected with HTTP 503 before the tool executes
- AND no mock-data read or mutation occurs

### Requirement: Structured success/error envelope

Packing tool results MUST use a structured success/error envelope. Successful object payloads MUST be returned as a JSON-encoded text content block. Not-found failures MUST surface `NOT_FOUND: packing item <id>` with `isError: true`. Unexpected failures MUST return a sanitized message and MUST NOT expose stack traces, database identifiers, or service-role credentials.

#### Scenario: Not-found result names the resource and id

- GIVEN an `update_packing_item` call for a packing-item id that does not exist
- WHEN the server returns the result
- THEN the result has `isError: true`
- AND the message is `NOT_FOUND: packing item <id>` where `<id>` is the caller-supplied id

### Requirement: Add a packing item

The `add_packing_item` tool MUST create a packing item for the caller-supplied trip from its `label` and `sortOrder` inputs, and MUST return the created packing item including its id.

#### Scenario: Add a packing item

- GIVEN an existing trip
- WHEN the agent calls `add_packing_item` with the trip's id and a label
- THEN a packing item is created and the result contains the new item with its id

### Requirement: Update a packing item

The `update_packing_item` tool MUST update an existing packing item from the caller-supplied partial fields, returning the updated packing item. When the packing item does not exist, the tool MUST return `NOT_FOUND: packing item <id>`.

#### Scenario: Update a packing item

- GIVEN a packing item with a known id
- WHEN the agent calls `update_packing_item` with that id and changed fields
- THEN the packing item is updated and the result contains the updated item

#### Scenario: Update a missing packing item

- GIVEN no packing item with the caller-supplied id
- WHEN the agent calls `update_packing_item` with that id
- THEN the result is `NOT_FOUND: packing item <id>` with `isError: true`

### Requirement: Delete a packing item

The `delete_packing_item` tool MUST delete the packing item matching the caller-supplied id.

#### Scenario: Delete a packing item

- GIVEN a packing item with a known id
- WHEN the agent calls `delete_packing_item` with that id
- THEN the packing item is deleted
