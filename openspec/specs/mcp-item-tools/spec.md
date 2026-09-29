# MCP Item Tools Specification

## Purpose

Expose TravelHub's itinerary-item domain to an external agent through the MCP server. The tools let an agent add, update, delete, restore, move, duplicate, and reorder the items within a trip's days.

## Requirements

### Requirement: Direct data-layer access under the service-role gate

Each tool MUST invoke the TravelHub data layer directly and MUST NOT pass an injected Supabase client or rely on any request-scoped client store. The MCP route's service-role gate MUST prevent any item tool from executing when the service role is absent, so no item tool MUST operate against in-memory mock data.

#### Scenario: Mock data never reachable

- GIVEN the Supabase service role is not configured
- WHEN the agent invokes any item tool
- THEN the request is rejected with HTTP 503 before the tool executes
- AND no mock-data read or mutation occurs

### Requirement: Structured success/error envelope

Item tool results MUST use a structured success/error envelope. Successful object payloads MUST be returned as a JSON-encoded text content block. Not-found failures MUST surface `NOT_FOUND: item <id>` with `isError: true`. Unexpected failures MUST return a sanitized message and MUST NOT expose stack traces, database identifiers, or service-role credentials.

#### Scenario: Not-found result names the resource and id

- GIVEN an `update_item` call for an item id that does not exist
- WHEN the server returns the result
- THEN the result has `isError: true`
- AND the message is `NOT_FOUND: item <id>` where `<id>` is the caller-supplied id

### Requirement: Add an item

The `add_item` tool MUST create an itinerary item from the caller-supplied input, whose `type` MUST be one of the supported item types (`flight`, `hotel`, `activity`, `restaurant`, `transport`, `note`), and MUST return the created item including its id. If a supplier reference is provided, the supplier MUST be compatible with the item type: `hotel` with `hotel`, `activity` with `tour_operator`, `restaurant` with `restaurant`, or `transport` with `transport`. `flight` and `note` items MUST NOT accept a supplier reference.

(Previously: `add_item` validated supported item types but did not define supplier compatibility.)

#### Scenario: Add an item with a compatible supplier

- GIVEN the agent supplies valid item input with a supported type and a compatible supplier reference
- WHEN the agent calls `add_item`
- THEN an item is created
- AND the result contains the new item with its id

#### Scenario: Add a supplier-free item

- GIVEN the agent supplies a flight or note item without a supplier reference
- WHEN the agent calls `add_item`
- THEN an item is created without a supplier reference
- AND the result contains the new item with its id

#### Scenario: Reject an incompatible supplier

- GIVEN the agent supplies a restaurant item with a hotel supplier reference
- WHEN the agent calls `add_item`
- THEN the call is rejected with a validation error
- AND no item is created

#### Scenario: Reject unsupported type

- GIVEN the agent supplies an item with an unsupported type
- WHEN the agent calls `add_item`
- THEN the call is rejected at schema validation
- AND no item is created

### Requirement: Update an item

The `update_item` tool MUST update an existing item from the caller-supplied partial fields, returning the updated item. The resulting item type and supplier reference MUST satisfy the compatibility mapping: `hotel` with `hotel`, `activity` with `tour_operator`, `restaurant` with `restaurant`, or `transport` with `transport`; `flight` and `note` MUST NOT retain a supplier reference. When the item does not exist, the tool MUST return `NOT_FOUND: item <id>`.

(Previously: `update_item` returned the updated item or a not-found error without defining supplier compatibility for the resulting item.)

#### Scenario: Update an item with a compatible supplier

- GIVEN an item with a known id
- WHEN the agent calls `update_item` with a compatible supplier and changed fields
- THEN the item is updated
- AND the result contains the updated item

#### Scenario: Reject an update that creates an incompatible relationship

- GIVEN an item with a known id
- WHEN the agent updates it so its resulting type and supplier are incompatible
- THEN the call is rejected with a validation error
- AND the existing item remains unchanged

#### Scenario: Reject adding a supplier to a supplier-free type

- GIVEN an item with a known id has type `flight` or `note`
- WHEN the agent updates it with a supplier reference
- THEN the call is rejected with a validation error
- AND the item remains without a supplier reference

#### Scenario: Update a missing item

- GIVEN no item with the caller-supplied id
- WHEN the agent calls `update_item` with that id
- THEN the result is `NOT_FOUND: item <id>` with `isError: true`
### Requirement: Delete an item

The `delete_item` tool MUST delete the item matching the caller-supplied id.

#### Scenario: Delete an item

- GIVEN an item with a known id
- WHEN the agent calls `delete_item` with that id
- THEN the item is deleted

### Requirement: Restore an item

The `restore_item` tool MUST restore a previously deleted item identified by the caller-supplied id.

#### Scenario: Restore an item

- GIVEN an item that was deleted
- WHEN the agent calls `restore_item` with that id
- THEN the item is restored

### Requirement: Move an item

The `move_item` tool MUST move the item identified by the caller-supplied item id to the caller-supplied target day.

#### Scenario: Move an item to another day

- GIVEN an item in day A
- WHEN the agent calls `move_item` with the item's id and day B's id
- THEN the item is relocated to day B

### Requirement: Duplicate an item

The `duplicate_item` tool MUST duplicate the item identified by the caller-supplied item id into the caller-supplied destination day, and MUST return the duplicated item. When the source item does not exist, the tool MUST return `NOT_FOUND: item <id>`.

#### Scenario: Duplicate an item

- GIVEN an item with a known id and a destination day
- WHEN the agent calls `duplicate_item` with the item's id and the destination day
- THEN a copy of the item is created in the destination day
- AND the result contains the duplicated item

#### Scenario: Duplicate a missing item

- GIVEN no item with the caller-supplied id
- WHEN the agent calls `duplicate_item` with that id
- THEN the result is `NOT_FOUND: item <id>` with `isError: true`

### Requirement: Reorder items

The `reorder_items` tool MUST apply the caller-supplied ordering (a list of `{ id, sortOrder }` entries) to the items.

#### Scenario: Reorder items

- GIVEN multiple items
- WHEN the agent calls `reorder_items` with a new ordering
- THEN the items are persisted in the supplied order
