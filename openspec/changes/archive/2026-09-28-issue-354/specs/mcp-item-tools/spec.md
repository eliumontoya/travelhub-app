# Delta for MCP Item Tools

## MODIFIED Requirements

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
