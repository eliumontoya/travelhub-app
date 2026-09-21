# MCP Supplier Tools Specification

## Purpose

Expose TravelHub's supplier domain to an external agent through the MCP server. The tools let an agent list, read, create, and update suppliers, and soft-delete or restore suppliers with the same business rules a human agent faces in the dashboard.

## Requirements

### Requirement: Direct data-layer access under the service-role gate

Each tool MUST invoke the TravelHub data layer directly and MUST NOT pass an injected Supabase client or rely on any request-scoped client store. The MCP route's service-role gate MUST prevent any supplier tool from executing when the service role is absent, so no supplier tool MUST operate against in-memory mock data.

#### Scenario: Mock data never reachable

- GIVEN the Supabase service role is not configured
- WHEN the agent invokes any supplier tool
- THEN the request is rejected with HTTP 503 before the tool executes
- AND no mock-data read or mutation occurs

### Requirement: Structured success/error envelope

Supplier tool results MUST use a structured success/error envelope. Successful object payloads MUST be returned as a JSON-encoded text content block. Not-found failures MUST surface `NOT_FOUND: supplier <id>` with `isError: true`. Unexpected failures MUST return a sanitized message and MUST NOT expose stack traces, database identifiers, or service-role credentials.

#### Scenario: Not-found result names the resource and id

- GIVEN a `get_supplier` call for a supplier id that does not exist
- WHEN the server returns the result
- THEN the result has `isError: true`
- AND the message is `NOT_FOUND: supplier <id>` where `<id>` is the caller-supplied id

### Requirement: List suppliers

The `list_suppliers` tool MUST return suppliers matching the optional `query`, `type`, and `tag` filters, in a paginated result respecting optional `page` and `pageSize`, and each returned supplier MUST include its identifier.

#### Scenario: List suppliers

- GIVEN one or more suppliers exist
- WHEN the agent calls `list_suppliers`
- THEN the result contains the suppliers
- AND each supplier includes its id

#### Scenario: Filtered list

- GIVEN suppliers of mixed types
- WHEN the agent calls `list_suppliers` with a `type` filter
- THEN the result contains only suppliers of that type

### Requirement: Get a supplier

The `get_supplier` tool MUST return the supplier matching the caller-supplied id, or a `NOT_FOUND: supplier <id>` error result when no such supplier exists.

#### Scenario: Get an existing supplier

- GIVEN a supplier with a known id
- WHEN the agent calls `get_supplier` with that id
- THEN the result contains that supplier's fields

#### Scenario: Get a missing supplier

- GIVEN no supplier with the caller-supplied id
- WHEN the agent calls `get_supplier` with that id
- THEN the result is `NOT_FOUND: supplier <id>` with `isError: true`

### Requirement: Create a supplier

The `create_supplier` tool MUST create a supplier from the caller-supplied input and MUST return the created supplier including its id.

#### Scenario: Create a supplier

- GIVEN the agent supplies valid supplier input
- WHEN the agent calls `create_supplier`
- THEN a supplier is created and the result contains the new supplier with its id

### Requirement: Update a supplier

The `update_supplier` tool MUST update an existing supplier from the caller-supplied partial fields, returning the updated supplier. When the supplier does not exist, the tool MUST return `NOT_FOUND: supplier <id>`.

#### Scenario: Update an existing supplier

- GIVEN a supplier with a known id
- WHEN the agent calls `update_supplier` with that id and changed fields
- THEN the supplier is updated and the result contains the updated supplier

#### Scenario: Update a missing supplier

- GIVEN no supplier with the caller-supplied id
- WHEN the agent calls `update_supplier` with that id
- THEN the result is `NOT_FOUND: supplier <id>` with `isError: true`

### Requirement: Soft-delete a supplier

The `delete_supplier` tool MUST soft-delete the supplier matching the caller-supplied id, returning `NOT_FOUND: supplier <id>` when it does not exist. When the supplier still has associated items and the caller does not set `force`, the tool MUST NOT delete and MUST return an unsuccessful result reporting the item count; when `force` is set, the tool MUST proceed with the soft-delete.

#### Scenario: Soft-delete a supplier

- GIVEN a supplier with no associated items
- WHEN the agent calls `delete_supplier` with the supplier's id
- THEN the supplier is soft-deleted and the result reports success

#### Scenario: Supplier with items blocked without force

- GIVEN a supplier that still has associated items
- WHEN the agent calls `delete_supplier` with the supplier's id and without `force`
- THEN the supplier is not deleted
- AND the result reports an unsuccessful outcome with the item count

#### Scenario: Force soft-delete a supplier with items

- GIVEN a supplier that still has associated items
- WHEN the agent calls `delete_supplier` with the supplier's id and `force: true`
- THEN the supplier is soft-deleted

#### Scenario: Delete a missing supplier

- GIVEN no supplier with the caller-supplied id
- WHEN the agent calls `delete_supplier` with that id
- THEN the result is `NOT_FOUND: supplier <id>` with `isError: true`

### Requirement: Restore a supplier

The `restore_supplier` tool MUST restore a soft-deleted supplier by clearing its soft-delete marker.

#### Scenario: Restore a soft-deleted supplier

- GIVEN a supplier that was soft-deleted
- WHEN the agent calls `restore_supplier` with the supplier's id
- THEN the supplier is restored and no longer appears soft-deleted
