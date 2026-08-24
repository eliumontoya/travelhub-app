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
