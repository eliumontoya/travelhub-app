# Data Layer Domain Boundaries Specification

**Baseline**: new-capability

## Purpose

Define the compatibility and behavior-preservation contract for extracting TravelHub data access from the monolithic `src/lib/data.ts` facade into bounded domain modules.

## Requirements

### Requirement: Facade export compatibility

`src/lib/data.ts` MUST remain the stable import surface for existing application code while domain modules own the extracted implementations.

#### Scenario: Existing named imports still resolve

- GIVEN application code imports client/tag, trip/itinerary, or document/storage functions from `@/lib/data`
- WHEN TypeScript compiles the project
- THEN those named exports MUST still resolve from the facade
- AND callers MUST NOT need to change import paths.

#### Scenario: Domain modules can be imported directly

- GIVEN future data-layer work targets one bounded context
- WHEN it imports from a domain module under `src/lib/data/`
- THEN the relevant functions and types SHOULD be available without importing the facade.

### Requirement: Mock-mode behavior preservation

Extracted domain modules MUST preserve the existing in-memory mock fallback behavior when Supabase is not configured.

#### Scenario: Client and tag contracts remain stable

- GIVEN Supabase configuration is absent
- WHEN clients or tags are listed, created, updated, deleted, or associated
- THEN results MUST match the pre-extraction facade behavior including pagination, ordering, sanitization, and empty-tag handling.

#### Scenario: Trip and itinerary contracts remain stable

- GIVEN Supabase configuration is absent
- WHEN trips, trip days, items, packing items, reminders, or templates are read or mutated
- THEN results MUST match the pre-extraction facade behavior including ordering, soft-deletion, publication, filtering, and detail assembly.

#### Scenario: Document and storage contracts remain stable

- GIVEN Supabase configuration is absent
- WHEN item, client, trip, photo, cover-image, or site-logo document APIs are called
- THEN mock-compatible APIs MUST keep their current no-op, URL, metadata, or error behavior.

### Requirement: Supabase/storage behavior preservation

Extracted domain modules MUST preserve existing Supabase table, storage bucket, mapper, and error-propagation behavior without schema changes.

#### Scenario: Supabase queries keep their contracts

- GIVEN Supabase is configured
- WHEN extracted data-layer functions execute
- THEN they MUST use the same tables, selected fields, ordering, filters, and error throwing semantics as before extraction.

#### Scenario: No schema migration required

- GIVEN this is a code-organization refactor
- WHEN the change is delivered
- THEN it MUST NOT add, remove, or modify migrations, RLS policies, database functions, or storage bucket definitions.
