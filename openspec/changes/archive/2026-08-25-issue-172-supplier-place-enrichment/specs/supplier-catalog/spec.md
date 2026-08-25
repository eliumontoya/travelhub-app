# Delta for Supplier Catalog

## ADDED Requirements

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
