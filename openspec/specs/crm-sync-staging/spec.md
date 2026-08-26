# CRM Sync Staging Specification

**Baseline**: new-capability

## Purpose

Stage durable events that allow server-side or external processors to synchronize TravelHub activity into an external CRM without coupling user-facing writes to CRM availability.

## Requirements

### Requirement: CRM sync event lifecycle
The system MUST represent CRM sync events as pending, processing, processed, or failed.

#### Scenario: Event is ready to process
- GIVEN a CRM sync event was created with pending status
- WHEN a server-side processor polls available events
- THEN the event MUST include availability and creation timestamps suitable for ordered processing

#### Scenario: Event fails
- GIVEN processing an event fails
- WHEN the failure is recorded
- THEN the event MUST be able to store failed status, attempt count, and last error

### Requirement: CRM event idempotency
The system SHOULD support an optional event key for logical event deduplication.

#### Scenario: Duplicate logical event
- GIVEN two staged events use the same non-empty event key
- WHEN both are inserted
- THEN the data model SHOULD reject the duplicate key

### Requirement: Private staging queue
The system MUST NOT expose CRM sync events to anonymous users.

#### Scenario: Anonymous queue access denied
- GIVEN a request uses the anon database role
- WHEN it accesses CRM sync staging data
- THEN it MUST have no direct table privileges

### Requirement: Server-side processor access
The system MUST allow future server-side service-role processors to read and write CRM sync events.

#### Scenario: Processor marks event processed
- GIVEN a server-side CRM sync processor completed an event
- WHEN it writes the result
- THEN the event MUST be able to store processed status and processed timestamp
