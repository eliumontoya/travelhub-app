# Delta for Supplier Catalog

## MODIFIED Requirements

### Requirement: Supplier use in itinerary items

The system MUST allow itinerary items to reference a supplier only when the supplier type is compatible with the item's type. The compatibility mapping MUST be `hotel` items to `hotel` suppliers, `activity` items to `tour_operator` suppliers, `restaurant` items to `restaurant` suppliers, and `transport` items to `transport` suppliers. The system MUST continue to allow supplier-free item types such as `flight` and `note`, and MUST NOT offer supplier type `other` for any current item type. The system SHOULD prefill relevant item metadata from selected supplier details where applicable.

(Previously: Itinerary items could reference a supplier without specifying a type-compatibility rule.)

#### Scenario: Attach a compatible supplier to an item

- GIVEN an agent edits a hotel, activity, restaurant, or transport item
- AND the selected supplier has the mapped compatible type for that item
- WHEN the agent selects the supplier
- THEN the item MUST persist the supplier reference

#### Scenario: Do not offer incompatible suppliers

- GIVEN an agent edits an item with a mapped supplier type
- WHEN the supplier selector is opened
- THEN suppliers with a different type MUST NOT be offered

#### Scenario: Supplier context remains visible

- GIVEN an item has a compatible supplier reference
- WHEN the item appears in the editor
- THEN supplier name and available location/contact context SHOULD be visible

## ADDED Requirements

### Requirement: Category-compatible supplier discovery and quick creation

The system MUST derive supplier discovery and quick-creation behavior from the active item's compatibility mapping. When the supplier field is focused with an empty query, the system MUST show all active suppliers compatible with the selected item type without requiring a keystroke. When the agent enters a query, the system MUST filter only that compatible set by normalized supplier name, including accent-insensitive matching. A quick-created supplier MUST start with the mapped supplier type for the active item type.

#### Scenario: Empty focus discloses all compatible suppliers

- GIVEN active suppliers exist for the selected item's compatible type
- AND the agent focuses the empty supplier field
- WHEN the selector opens
- THEN all active compatible suppliers MUST be shown
- AND no incompatible supplier MUST be shown

#### Scenario: Typed search stays within the compatible set

- GIVEN compatible and incompatible suppliers have similar names
- WHEN the agent types a name query
- THEN matching compatible suppliers MUST be shown
- AND matching incompatible suppliers MUST NOT be shown

#### Scenario: Accent-insensitive supplier search

- GIVEN an active compatible supplier has accented characters in its name
- WHEN the agent types the equivalent unaccented name
- THEN the supplier MUST be included in the results

#### Scenario: Quick creation inherits the item mapping

- GIVEN the active item type maps to a supplier type
- WHEN the agent opens quick-create from the supplier selector
- THEN the new supplier form MUST default to that mapped supplier type
