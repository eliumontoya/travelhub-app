## MODIFIED Requirements

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
