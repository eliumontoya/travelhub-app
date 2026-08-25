# Spec: Duplicate item (issue #131)

## Requirements

### Requirement 1 — Item duplicate action is available per item
The trip editor MUST show a "Duplicar" control for each item, alongside the
existing reorder / edit / delete controls.

#### Scenario: duplicate control is present
- Given a trip with at least one item
- When the agent opens the trip editor
- Then each item shows a "Duplicar" control

### Requirement 2 — Destination day is chosen by the agent
Activating the control opens a dialog listing every day of the same trip (the
source day included). The agent selects the destination day and confirms.

#### Scenario: duplicate to a different day
- Given item A on day 1
- When the agent duplicates A and selects day 3
- Then a new item equal to A is created on day 3
- And day 1 still contains the original A

#### Scenario: duplicate to the same day
- Given item A on day 1
- When the agent duplicates A and selects day 1
- Then a second copy of A exists on day 1 (original preserved)

### Requirement 3 — All scalar fields and metadata are copied
The duplicate MUST copy type, title, start/end time, location, lat/lng,
confirmation code, notes, cost, supplier and type-specific metadata.

#### Scenario: fields are preserved
- Given item A with title, type, time, location, cost and metadata
- When the duplicate is created on day N
- Then the new item has the same values for all those fields

### Requirement 4 — Duplicate is appended at the end of the destination day
The new item's `sortOrder` MUST be greater than every existing item in the
destination day.

#### Scenario: ordering
- Given day N already has 2 items
- When an item is duplicated into day N
- Then the new item has `sortOrder` >= 2 (appended last)

### Requirement 5 — Documents are not copied
Attached documents MUST NOT be duplicated; the new item has no documents.

#### Scenario: no documents
- Given item A has a document attached
- When A is duplicated
- Then the new item has no documents
