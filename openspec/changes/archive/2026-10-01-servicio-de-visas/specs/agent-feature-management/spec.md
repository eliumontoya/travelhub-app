# Delta for Agent Feature Management

## MODIFIED Requirements

### Requirement: Update per-agent features

The system MUST allow an administrator to update the `features` assigned to an account profile. The update MUST persist the exact set of recognized features provided. Assigning an empty feature set MUST be a valid update that clears all features. A value that is not a recognized feature MUST NOT be persisted. The recognized feature catalog now includes seven features: the six previously recognized features plus `visas`.

(Previously: The recognized feature catalog contained six features; an update request containing a value not in the six-feature catalog was rejected.)

#### Scenario: Admin assigns features

- GIVEN an administrator editing an agent profile
- WHEN the administrator selects a set of features and saves
- THEN the agent's `features` MUST be updated to exactly the selected recognized features

#### Scenario: Admin clears features

- GIVEN an administrator editing an agent profile
- WHEN the administrator removes all features and saves
- THEN the agent's `features` MUST be updated to an empty set

#### Scenario: Unknown feature not persisted

- GIVEN an update request containing a value that is not in the seven-feature catalog
- WHEN the update is applied
- THEN the unknown value MUST NOT be persisted in the profile's `features`

#### Scenario: Admin assigns the visas feature

- GIVEN an administrator editing an agent profile
- WHEN the administrator includes `visas` in the selected features and saves
- THEN the agent's `features` MUST include `visas`
- AND the agent MUST subsequently be able to access the visa-management surface.

## ADDED Requirements

### Requirement: Visas in the recognized feature catalog

The system MUST recognize `visas` as a valid feature in the feature catalog. The `visas` feature MUST be included in `AVAILABLE_FEATURES` and `FEATURE_DEFINITIONS` with a dashboard entry point at `/dashboard/visas`.

#### Scenario: visas appears in the feature catalog

- GIVEN the system's feature catalog
- WHEN the catalog is enumerated
- THEN `visas` MUST be present in `AVAILABLE_FEATURES`
- AND `FEATURE_DEFINITIONS` MUST include a `visas` entry with `href` set to `/dashboard/visas`.

#### Scenario: visas is assignable through the admin UI

- GIVEN an administrator opening the feature-management UI
- WHEN the administrator views the list of assignable features
- THEN `visas` MUST be listed alongside the other recognized features.

#### Scenario: visas toggle takes effect immediately

- GIVEN an administrator enables the `visas` feature for an agent
- WHEN the agent next loads the dashboard
- THEN the visa navigation entry MUST be visible to the agent.
