# Delta for Trip Itinerary

## MODIFIED Requirements

### Requirement: Day and item itinerary editing

The system MUST let the agent add, edit, soft-delete, restore, and reorder trip days and itinerary items; supported item types are flight, hotel, activity, restaurant, transport, and note. Item create and update operations MUST accept either no supplier reference or a supplier whose type is compatible with the resulting item type. The authenticated trip editor MUST clear a selected supplier when an item type change makes that supplier incompatible before submission, while preserving a compatible selection when the item type remains unchanged or the existing selection remains valid.

(Previously: Itinerary item editing covered item lifecycle and structured metadata validation but did not define supplier compatibility or stale-selection handling.)

#### Scenario: Generate missing days

- GIVEN a trip has a start and end date but not every date exists as a day
- WHEN the agent runs day generation
- THEN the system MUST create only the missing days in date order

#### Scenario: Validate structured item metadata

- GIVEN the agent submits metadata for a typed item
- WHEN required metadata fields for that type are missing
- THEN the system MUST reject invalid metadata instead of persisting it

#### Scenario: Clear a stale supplier after category change

- GIVEN an item has a hotel supplier selected
- WHEN the agent changes the item type to restaurant
- THEN the supplier selection MUST be cleared before the item is submitted
- AND the item MUST NOT retain the incompatible hotel supplier reference

#### Scenario: Preserve a valid supplier selection

- GIVEN an item has a hotel supplier selected
- WHEN the agent edits other item fields without changing the item type
- THEN the supplier selection MUST remain selected
- AND the item MUST retain the compatible supplier reference after save

#### Scenario: Supplier-free item types remain valid

- GIVEN the agent creates or edits a flight or note item without a supplier
- WHEN the item is submitted
- THEN the item MUST be persisted without a supplier reference

#### Scenario: Trusted item write rejects an incompatible supplier

- GIVEN an item write requests a restaurant item with a hotel supplier reference
- WHEN the trusted create or update operation processes the request
- THEN the operation MUST reject the request with a validation error
- AND no item with the incompatible relationship MUST be persisted
