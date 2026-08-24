# Trip Itinerary Specification

**Baseline**: baseline-from-current-implementation

## Purpose

Create, organize, enrich, publish, quote, template, and archive travel itineraries.

## Requirements

### Requirement: Trip creation and assignment

The system MUST let the agent create trips with title, date range, instructions, one or more clients, optional new client creation, optional template source, traveler count, status, currency, and tags.

#### Scenario: Create trip for existing clients

- GIVEN one or more clients exist
- WHEN the agent creates a trip with title, dates, and selected clients
- THEN the system MUST create the trip and redirect to its editor

#### Scenario: Block trip without clients

- GIVEN the agent submits a new trip without any selected client
- WHEN the request is processed
- THEN the system MUST reject it with a validation error

### Requirement: Day and item itinerary editing

The system MUST let the agent add, edit, soft-delete, restore, and reorder trip days and itinerary items; supported item types are flight, hotel, activity, restaurant, transport, and note.

#### Scenario: Generate missing days

- GIVEN a trip has a start and end date but not every date exists as a day
- WHEN the agent runs day generation
- THEN the system MUST create only the missing days in date order

#### Scenario: Validate structured item metadata

- GIVEN the agent submits metadata for a typed item
- WHEN required metadata fields for that type are missing
- THEN the system MUST reject invalid metadata instead of persisting it

### Requirement: Item duplication within a trip

The system MUST let the agent duplicate an itinerary item into any day of the same trip. The duplicate copies all scalar fields and metadata; documents MUST NOT be copied. The new item is appended at the end of the destination day's sort order.

#### Scenario: Duplicate item to a different day

- GIVEN item A on day 1
- WHEN the agent duplicates A and selects day 3
- THEN a new item equal to A is created on day 3
- AND day 1 still contains the original A

#### Scenario: Duplicate item to the same day

- GIVEN item A on day 1
- WHEN the agent duplicates A and selects day 1
- THEN a second copy of A exists on day 1 (original preserved)

#### Scenario: No documents in duplicate

- GIVEN item A has a document attached
- WHEN A is duplicated
- THEN the new item has no documents

### Requirement: Agent-only itinerary enrichment

The system MUST support internal notes, documents, photo gallery, packing list, budget, sale price, commission, per-item costs, supplier references, maps, weather, and flight-status enrichment.

#### Scenario: Keep internal notes private

- GIVEN an itinerary contains internal notes, sale price, and commission
- WHEN the public trip page is rendered
- THEN those agent-only fields MUST NOT be included in the public traveler view

#### Scenario: Attach trip materials

- GIVEN the agent uploads item documents, client documents, or trip photos
- WHEN storage is configured
- THEN the system MUST persist the attachment metadata and make it available in the relevant editor view

### Requirement: Trip lifecycle and reuse

The system MUST support draft, published, and archived status transitions, status history, save-as-template, duplicate-from-template, and quote printing.

#### Scenario: Publish an itinerary

- GIVEN a draft trip has a public slug
- WHEN the agent publishes it
- THEN public access by `/t/{slug}` MUST become available

#### Scenario: Reuse a template

- GIVEN a template trip exists
- WHEN the agent creates a new trip from that template
- THEN the new trip MUST copy template days and items without copying documents

### Requirement: Move item to a different day

The system SHALL provide a way to reassign an existing itinerary item to another day of the same trip without deleting and recreating it. The move preserves all item fields (title, type, times, location, cost, notes, metadata, supplier, documents linkage) and appends the item at the end of the destination day's sort order.

#### Scenario: Move item to another day

- GIVEN a trip with day A and day B, each containing at least one item
- WHEN the agent reassigns an item from day A to day B
- THEN the item is removed from day A's list
- AND the item appears at the end of day B's list
- AND the item's title, type, times, location, cost, notes, metadata and supplier are unchanged

#### Scenario: Reassigned item reflected in public view

- GIVEN an item reassigned from day A to day B in the dashboard
- WHEN the public view `/t/[slug]` is rendered
- THEN the item is shown under day B, not day A

### Requirement: Destination day selection

The UI SHALL present a list of the trip's days (excluding the item's current day) so the agent can pick the destination day.

#### Scenario: Current day excluded from choices

- GIVEN an item currently on day A
- WHEN the agent opens the move-to-day control
- THEN day A is not offered as a destination

### Requirement: Move item dual-mode support

The move-item-to-day reassignment SHALL work identically in mock mode (no Supabase configured) and Supabase mode.

#### Scenario: Move item in mock mode

- GIVEN the app running without Supabase env vars
- WHEN the agent reassigns an item to another day
- THEN the change persists for the session and renders correctly
