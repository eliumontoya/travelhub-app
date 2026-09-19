# Service Checklist Management Specification

## Purpose

Allow the travel agent to define, edit, and order the checklist items that a client must fulfill for a service.

## Requirements

### Requirement: Agent can add checklist items

The agent MUST be able to add items to a service checklist. Each item MUST have a label and a flag indicating whether it is required or optional.

#### Scenario: Add a required item

- GIVEN a service S exists with an empty checklist
- WHEN the agent adds an item with label "Passport copy" and `required = true`
- THEN the item is appended to the checklist with the next available sort order

#### Scenario: Add an optional item

- GIVEN a service S exists
- WHEN the agent adds an item with label "Travel insurance" and `required = false`
- THEN the item is added and marked as optional

### Requirement: Agent can edit checklist items

The agent MUST be able to update the label and required flag of an existing checklist item.

#### Scenario: Edit item label

- GIVEN a checklist item "Passport copy" exists on service S
- WHEN the agent changes the label to "Passport scan (color)"
- THEN the item label is updated and all associated uploads remain linked

### Requirement: Agent can delete checklist items

The agent MUST be able to remove a checklist item. Deleting an item MUST also remove any associated upload records and storage objects.

#### Scenario: Delete item with uploaded file

- GIVEN a checklist item has an upload in status `uploaded`
- WHEN the agent deletes the item
- THEN the item, its upload record, and the corresponding storage object are all removed

#### Scenario: Delete item with no upload

- GIVEN a checklist item has no upload
- WHEN the agent deletes the item
- THEN the item is removed with no side effects

### Requirement: Agent can reorder checklist items

The agent MUST be able to change the display order of checklist items. The order MUST be persisted and reflected in the client portal.

#### Scenario: Move item to top

- GIVEN a checklist with items A (order 1), B (order 2), C (order 3)
- WHEN the agent moves C to position 1
- THEN the persisted order becomes C (1), A (2), B (3)

### Requirement: Client cannot mutate the checklist

The client portal MUST NOT expose any operation that creates, updates, deletes, or reorders checklist items. Only the agent MAY mutate the checklist.

#### Scenario: Client has no checklist write surface

- GIVEN a client is viewing the checklist for their service
- WHEN the client attempts to add, edit, delete, or reorder items via any client-facing route or action
- THEN the operation is rejected or not available
