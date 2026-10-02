# Delta for Data Layer Domain Boundaries

## ADDED Requirements

### Requirement: Visa domain module behind the facade

The `src/lib/data.ts` facade MUST re-export the `visas` domain module so that existing application code can import visa operations from the facade. The `visas` domain module MUST also be importable directly from `src/lib/data/visas.ts`.

#### Scenario: Visa imports resolve through the facade

- GIVEN application code imports visa functions from `@/lib/data`
- WHEN TypeScript compiles the project
- THEN those named exports MUST resolve from the facade
- AND callers MUST NOT need to change import paths.

#### Scenario: Visa domain module imported directly

- GIVEN new data-layer work targeting the visas bounded context
- WHEN it imports from `src/lib/data/visas`
- THEN the relevant visa functions and types MUST be available without importing the facade.

### Requirement: Visa documents domain module behind the facade

The `src/lib/data.ts` facade MUST re-export the `visa-documents` domain module. The `visa-documents` domain module MUST also be importable directly from `src/lib/data/visa-documents.ts`.

#### Scenario: Visa document imports resolve through the facade

- GIVEN application code imports visa-document functions from `@/lib/data`
- WHEN TypeScript compiles the project
- THEN those named exports MUST resolve from the facade.

#### Scenario: Visa documents domain module imported directly

- GIVEN new data-layer work targeting the visa-documents bounded context
- WHEN it imports from `src/lib/data/visa-documents`
- THEN the relevant visa-document functions and types MUST be available without importing the facade.

### Requirement: Visa mock-mode behavior preservation

The extracted `visas` and `visa-documents` domain modules MUST preserve the in-memory mock fallback behavior when Supabase is not configured. In mock mode, every visa and visa-document mutation MUST update the in-memory mock state so that subsequent reads reflect the change, mirroring the Supabase write.

#### Scenario: Visa mock create is readable

- GIVEN Supabase configuration is absent
- WHEN a visa is created through the mock data path
- THEN a subsequent list or detail read MUST return the created visa with its assigned clients and status.

#### Scenario: Visa document mock upload is readable

- GIVEN Supabase configuration is absent
- WHEN a visa document is uploaded through the mock data path
- THEN a subsequent list of that visa's documents MUST include the uploaded document.

#### Scenario: Visa and visa-document Supabase queries keep their contracts

- GIVEN Supabase is configured
- WHEN visa or visa-document data-layer functions execute
- THEN they MUST use the correct tables, selected fields, ordering, filters, and error throwing semantics defined for the visas domain.

### Requirement: No cross-domain leakage between visas and trips

The `visas` and `visa-documents` domain modules MUST NOT share tables, storage paths, or identifiers with the `trips` domain or the `services` / `service_checklist_items` / `service_uploads` tables.

#### Scenario: Visa operations do not touch trip tables

- GIVEN a visa-management or visa-document operation
- WHEN the operation executes in Supabase mode
- THEN no query against `trips`, `trip_clients`, `trip_status_history`, `trip_documents`, `services`, `service_checklist_items`, or `service_uploads` MUST be issued as a side effect.

#### Scenario: Visa storage paths are isolated

- GIVEN a visa document file persisted in storage
- WHEN the storage path is inspected
- THEN it MUST reside under the `visa-documents` storage bucket
- AND MUST NOT reside under the `trip-documents` bucket or any trip-scoped path.
