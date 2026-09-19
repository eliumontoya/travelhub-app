# Service Auto-Creation Specification

## Purpose

Automatically provision a service record when a client is assigned to a trip, and cascade-delete it when the trip is removed.

## Requirements

### Requirement: Service provisioning on assignment

The system SHALL create exactly one active service record of type `trip_documents` when a client is assigned to a trip. The service MUST be uniquely constrained on `(trip_id, client_id, service_type)` so that re-assigning the same client to the same trip does not create a duplicate.

#### Scenario: First assignment creates a service

- GIVEN a trip exists with no prior assignment for client C
- WHEN the agent assigns client C to the trip
- THEN exactly one active service record is created with `trip_id`, `client_id`, and `service_type = 'trip_documents'`

#### Scenario: Re-assigning the same client is idempotent

- GIVEN a service already exists for (trip T, client C, `trip_documents`)
- WHEN the agent re-assigns client C to trip T (e.g., via `setTripClients`)
- THEN no additional service record is created and the existing service remains active

#### Scenario: Multiple clients on one trip each get their own service

- GIVEN a trip T with no services
- WHEN the agent assigns clients A and B to trip T in one operation
- THEN two distinct service records are created: one for (T, A) and one for (T, B)

### Requirement: Cascade deletion on trip removal

The system SHALL delete all service records, their checklist items, and their uploads (including storage objects) when the parent trip is deleted.

#### Scenario: Trip deletion removes all associated services

- GIVEN trip T has two services, each with checklist items and uploads
- WHEN the agent deletes trip T
- THEN all service records, checklist items, and upload records for trip T are removed
- AND all corresponding storage objects are deleted from the bucket

### Requirement: Service uniqueness guarantee

The system MUST reject any operation that would result in more than one active service for the same `(trip_id, client_id, service_type)` combination.

#### Scenario: Concurrent duplicate creation is prevented

- GIVEN no service exists for (trip T, client C, `trip_documents`)
- WHEN two concurrent operations attempt to create a service for (T, C, `trip_documents`)
- THEN exactly one service record is created and the other operation either returns the existing record or fails with a uniqueness error
