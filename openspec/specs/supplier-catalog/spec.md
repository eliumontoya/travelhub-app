# Supplier Catalog Specification

**Baseline**: baseline-from-current-implementation

## Purpose

Maintain reusable supplier records that can be referenced from itinerary items.

## Requirements

### Requirement: Supplier CRUD

The system MUST let the agent create, list, update, soft-delete, force-delete after confirmation, and restore suppliers with name, type, contact fields, website, address, coordinates, notes, tags, and an optional Google Places identifier.

#### Scenario: Create supplier

- GIVEN the agent opens the supplier catalog
- WHEN they submit a supplier with a name and type
- THEN the supplier MUST appear in the active supplier list

#### Scenario: Create supplier with Google place metadata

- GIVEN a supplier submission includes name, type, address, latitude, longitude, and `googlePlaceId`
- WHEN it is persisted
- THEN the saved supplier MUST retain address, coordinates, and `googlePlaceId`

#### Scenario: Block unconfirmed delete with references

- GIVEN a supplier is referenced by one or more itinerary items
- WHEN the agent attempts a normal soft delete
- THEN the system MUST report that the supplier is in use and require confirmation

#### Scenario: Restore supplier

- GIVEN a supplier was soft-deleted
- WHEN the agent restores it
- THEN the supplier MUST reappear in active catalog results


### Requirement: Google Places-assisted supplier capture

The system MUST provide optional Google Places-assisted supplier capture when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is configured and MUST keep manual supplier capture usable when the key is missing or the Google script fails.

#### Scenario: Autocomplete fills supplier fields

- GIVEN Google Places is configured
- WHEN the agent selects a result with name, formatted address, geometry, and place id
- THEN supplier name, address, latitude, longitude, and `googlePlaceId` MUST be filled before submission

#### Scenario: Autocomplete values remain editable

- GIVEN autocomplete filled supplier fields
- WHEN the agent edits those fields before saving
- THEN the manually edited values MUST be submitted

#### Scenario: Manual fallback

- GIVEN the Google key is missing or the Google script fails
- WHEN the supplier dialog opens
- THEN manual supplier fields MUST remain usable
- AND the UI SHOULD explain that Places search is unavailable or not configured


### Requirement: Supplier Google Places Enrichment

The system MUST let the agent enrich an existing supplier from Google Places only after human review and explicit confirmation.

#### Scenario: Enrich existing supplier from confirmed match

- GIVEN an existing supplier lacks address, coordinates, or a Google Places identifier
- WHEN the agent searches Google Places, selects a candidate, reviews the comparison, and confirms
- THEN the supplier MUST persist the candidate address, coordinates, and `googlePlaceId`
- AND the supplier MUST remain in the catalog after refresh

#### Scenario: Choose among multiple candidates

- GIVEN Google Places returns multiple candidates for a supplier
- WHEN the agent selects one candidate
- THEN the system MUST show current supplier data next to the selected candidate data before saving
- AND the agent MUST be able to cancel without modifying the supplier

#### Scenario: Do not modify before confirmation

- GIVEN an enrichment dialog is open with a selected candidate
- WHEN the agent closes or cancels before confirming
- THEN the supplier MUST retain its current address, coordinates, and `googlePlaceId`

#### Scenario: No reliable Google candidates

- GIVEN Google Places is unavailable, unconfigured, errors, or returns no candidates
- WHEN the agent attempts enrichment
- THEN the system MUST show a non-blocking message
- AND the supplier MUST remain editable manually

### Requirement: Supplier catalog discovery

The system MUST provide `/dashboard/suppliers` with searchable, filterable, paginated supplier results by query, type, and tags, and MUST visually identify suppliers that have a persisted Google Places identifier.

#### Scenario: Search suppliers

- GIVEN suppliers exist with different names
- WHEN the agent enters a search query
- THEN only suppliers matching the query MUST be shown

#### Scenario: Filter suppliers

- GIVEN suppliers exist with different types or tags
- WHEN the agent applies type or tag filters
- THEN only matching active suppliers MUST be shown

#### Scenario: Mark Google-matched suppliers

- GIVEN a supplier has a non-empty `googlePlaceId`
- WHEN the agent views `/dashboard/suppliers`
- THEN that supplier row MUST show an accessible Google Maps/Places badge near the supplier name

#### Scenario: Do not mark manual suppliers

- GIVEN a supplier does not have a `googlePlaceId`
- WHEN the agent views `/dashboard/suppliers`
- THEN that supplier row MUST NOT show the Google Maps/Places badge

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

### Requirement: Sanitized note storage

The data layer MUST store note text as HTML sanitized through a single server-side `sanitizeNote` helper before persisting `suppliers.notes`.

#### Scenario: Script tags are stripped on write

- GIVEN an agent submits a supplier note containing `<script>alert(1)</script>`
- WHEN the value is persisted through `src/lib/data.ts`
- THEN the stored value MUST NOT contain a `<script>` tag

#### Scenario: Allowed formatting is preserved

- GIVEN an agent submits `<p>Texto <strong>clave</strong></p><ul><li>a</li></ul>`
- WHEN the value is persisted
- THEN the stored value MUST retain `<strong>` and the `<ul>/<li>` list
