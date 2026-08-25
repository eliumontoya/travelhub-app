## MODIFIED Requirements

### Requirement: Supplier CRUD
The system MUST let agents create/list/update/delete/restore suppliers with existing fields plus optional `googlePlaceId`.

#### Scenario: Create supplier with Google place metadata
- GIVEN a supplier submission includes name, type, address, lat, lng, and `googlePlaceId`
- WHEN it is persisted
- THEN the saved supplier MUST retain address, coordinates, and `googlePlaceId`

## ADDED Requirements

### Requirement: Google Places-assisted supplier capture
The system MUST provide optional Places-assisted capture when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is configured and MUST keep manual capture usable when it is missing or fails.

#### Scenario: Autocomplete fills fields
- GIVEN Google Places is configured
- WHEN the agent selects a result with name, formatted address, geometry, and place id
- THEN supplier name, address, lat, lng, and `googlePlaceId` MUST be filled before submission

#### Scenario: Values remain editable
- GIVEN autocomplete filled supplier fields
- WHEN the agent edits those fields before saving
- THEN the manually edited values MUST be submitted

#### Scenario: Manual fallback
- GIVEN the key is missing or the Google script fails
- WHEN the dialog opens
- THEN manual supplier fields MUST remain usable
- AND the UI SHOULD explain that Places search is unavailable/not configured
