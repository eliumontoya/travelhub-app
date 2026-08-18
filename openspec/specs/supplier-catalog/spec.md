# Supplier Catalog Specification

**Baseline**: baseline-from-current-implementation

## Purpose

Maintain reusable supplier records that can be referenced from itinerary items.

## Requirements

### Requirement: Supplier CRUD

The system MUST let the agent create, list, update, soft-delete, force-delete after confirmation, and restore suppliers with name, type, contact fields, website, address, coordinates, notes, and tags.

#### Scenario: Create supplier

- GIVEN the agent opens the supplier catalog
- WHEN they submit a supplier with a name and type
- THEN the supplier MUST appear in the active supplier list

#### Scenario: Block unconfirmed delete with references

- GIVEN a supplier is referenced by one or more itinerary items
- WHEN the agent attempts a normal soft delete
- THEN the system MUST report that the supplier is in use and require confirmation

#### Scenario: Restore supplier

- GIVEN a supplier was soft-deleted
- WHEN the agent restores it
- THEN the supplier MUST reappear in active catalog results

### Requirement: Supplier catalog discovery

The system MUST provide `/dashboard/suppliers` with searchable, filterable, paginated supplier results by query, type, and tags.

#### Scenario: Search suppliers

- GIVEN suppliers exist with different names
- WHEN the agent enters a search query
- THEN only suppliers matching the query MUST be shown

#### Scenario: Filter suppliers

- GIVEN suppliers exist with different types or tags
- WHEN the agent applies type or tag filters
- THEN only matching active suppliers MUST be shown

### Requirement: Supplier use in itinerary items

The system MUST allow itinerary items to reference a supplier and SHOULD prefill relevant item metadata from selected supplier details where applicable.

#### Scenario: Attach supplier to item

- GIVEN an agent edits a hotel, restaurant, transport, or activity item
- WHEN they select a supplier
- THEN the item MUST persist the supplier reference

#### Scenario: Display supplier context

- GIVEN an item has a supplier reference
- WHEN the item appears in the editor
- THEN supplier name and available location/contact context SHOULD be visible
