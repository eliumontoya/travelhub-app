# Agent Feature Management Specification

## Purpose

Provide an administrator-facing capability to manage per-agent feature assignments: list account profiles with their current features, and update each agent's feature set through a write path that is admin-only in both Supabase and mock mode.

## Requirements

### Requirement: List account profiles

The system MUST allow an administrator to list account profiles, each with its role and current `features`. A non-administrator MUST NOT be able to list profiles.

#### Scenario: Admin lists profiles

- GIVEN an authenticated administrator
- WHEN the administrator opens the feature-management view
- THEN the system MUST show every account profile with its role and current features

#### Scenario: Non-admin denied profile listing

- GIVEN an authenticated agent
- WHEN the agent attempts to list account profiles
- THEN the system MUST deny the listing

### Requirement: Update per-agent features

The system MUST allow an administrator to update the `features` assigned to an account profile. The update MUST persist the exact set of recognized features provided. Assigning an empty feature set MUST be a valid update that clears all features. A value that is not a recognized feature MUST NOT be persisted.

#### Scenario: Admin assigns features

- GIVEN an administrator editing an agent profile
- WHEN the administrator selects a set of features and saves
- THEN the agent's `features` MUST be updated to exactly the selected recognized features

#### Scenario: Admin clears features

- GIVEN an administrator editing an agent profile
- WHEN the administrator removes all features and saves
- THEN the agent's `features` MUST be updated to an empty set

#### Scenario: Unknown feature not persisted

- GIVEN an update request containing a value that is not in the six-feature catalog
- WHEN the update is applied
- THEN the unknown value MUST NOT be persisted in the profile's `features`

### Requirement: Admin-only write authorization

Feature assignment MUST be writable only by administrators. The database MUST allow only an administrator to update the `features` column of a profile, and an agent MUST NOT be able to update their own or any other profile's features.

#### Scenario: Admin write succeeds under policy

- GIVEN an authenticated administrator and an RLS-protected `profiles` table
- WHEN the administrator updates an agent's `features`
- THEN the update MUST succeed and persist

#### Scenario: Agent write denied

- GIVEN an authenticated agent
- WHEN the agent attempts to update any profile's `features`
- THEN the update MUST be denied

### Requirement: Dual-mode write parity

The feature-management write path MUST behave identically in Supabase mode and mock mode. In mock mode, an update MUST mutate the in-memory mock profiles so that subsequent reads reflect the change, mirroring the Supabase write.

#### Scenario: Mock update persists in memory

- GIVEN Supabase is not configured
- WHEN an administrator updates an agent's `features`
- THEN a subsequent read of that profile MUST reflect the updated features

#### Scenario: Supabase and mock return the same result

- GIVEN the same feature update applied in Supabase mode and in mock mode
- WHEN the profile is re-read
- THEN both modes MUST return the same updated feature set
