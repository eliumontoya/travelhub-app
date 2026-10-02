# Visa Documents Specification

## Purpose

Provide a per-visa-application document model that supports both agent-uploaded documents and traveler-requested upload flows, including request, re-upload request, and review operations. Visa documents are owned by the visa application itself; they do not reuse the `services`, `service_checklist_items`, or `service_uploads` tables. Storage access MUST be server-side only.

## Requirements

### Requirement: Per-visa document ownership

Every visa document MUST belong to exactly one visa application. The visa document model MUST NOT share storage, rows, or identifiers with the trip `services` / `service_checklist_items` / `service_uploads` tables.

#### Scenario: Document is scoped to a single visa

- GIVEN a visa application `V1` and a separate visa application `V2`
- WHEN an agent uploads a document to `V1`
- THEN the document MUST be associated with `V1` only
- AND querying documents for `V2` MUST NOT return it.

#### Scenario: Document model is independent from services

- GIVEN the visa document schema
- WHEN the system persists a visa document
- THEN no row in `services`, `service_checklist_items`, or `service_uploads` MUST be created or modified as a side effect.

### Requirement: Agent uploads a visa document

The system MUST allow an authenticated agent to upload a document to a specific visa application. The upload MUST record the target visa identifier, the uploader identity, the file metadata, and an initial status of `uploaded`.

#### Scenario: Agent uploads a document to a visa

- GIVEN an authenticated agent and an existing visa application `V1`
- WHEN the agent uploads a file to `V1`
- THEN a new visa document MUST be persisted for `V1` with status `uploaded`
- AND the document MUST record the agent as the uploader.

#### Scenario: Agent cannot upload to a non-existent visa

- GIVEN an authenticated agent
- WHEN the agent attempts to upload a document to a visa identifier that does not exist
- THEN the system MUST reject the upload.

### Requirement: Agent requests a document from a traveler

The system MUST allow an authenticated agent to define a document requirement for a specific visa application and assign it to one of the visa's assigned travelers. The request MUST record the target visa, the target traveler, the requested document description, and an initial status of `requested`.

#### Scenario: Agent requests passport scan from traveler

- GIVEN an authenticated agent, a visa `V1` assigned to traveler `T1`
- WHEN the agent requests a "passport scan" document from `T1` for `V1`
- THEN a new visa document requirement MUST be persisted for `V1` targeting `T1` with status `requested`.

#### Scenario: Agent cannot request a document for a non-assigned traveler

- GIVEN a visa `V1` not assigned to traveler `T2`
- WHEN the agent attempts to request a document from `T2` for `V1`
- THEN the system MUST reject the request.

### Requirement: Traveler uploads a requested document

The system MUST allow an assigned traveler to upload a file in response to a document request for a visa application. A successful traveler upload MUST transition the document status from `requested` (or `re_upload_requested`) to `uploaded`.

#### Scenario: Traveler uploads in response to a request

- GIVEN a visa document requirement with status `requested` targeting traveler `T1` for visa `V1`
- WHEN `T1` uploads the requested file
- THEN the document status MUST transition to `uploaded`
- AND the uploaded file MUST be associated with that document requirement.

#### Scenario: Traveler re-uploads after re-upload request

- GIVEN a visa document with status `re_upload_requested` targeting traveler `T1`
- WHEN `T1` uploads a replacement file
- THEN the document status MUST transition to `uploaded`
- AND the new file MUST replace the previous upload reference.

#### Scenario: Non-assigned traveler cannot upload

- GIVEN a visa document requirement targeting traveler `T1`
- WHEN a different traveler `T3` attempts to upload
- THEN the system MUST reject the upload.

### Requirement: Agent reviews an uploaded document

The system MUST allow an authenticated agent to mark an uploaded visa document as `reviewed` (accepted) or `processed` (fully handled). The agent MAY also request a re-upload, which transitions the document status to `re_upload_requested`.

#### Scenario: Agent marks document as reviewed

- GIVEN an authenticated agent and a visa document with status `uploaded`
- WHEN the agent marks the document as reviewed
- THEN the document status MUST become `reviewed`.

#### Scenario: Agent marks document as processed

- GIVEN an authenticated agent and a visa document with status `reviewed`
- WHEN the agent marks the document as processed
- THEN the document status MUST become `processed`.

#### Scenario: Agent requests re-upload

- GIVEN an authenticated agent and a visa document with status `uploaded`
- WHEN the agent requests a re-upload
- THEN the document status MUST become `re_upload_requested`
- AND the traveler MUST be able to upload a replacement file.

### Requirement: Document status vocabulary

Visa documents MUST use the status vocabulary `uploaded`, `reviewed`, `processed`, and `re_upload_requested`. The system MUST NOT allow any other status value for a visa document.

#### Scenario: Only recognized statuses are persisted

- GIVEN a visa document operation
- WHEN the operation attempts to set a status value outside the recognized vocabulary
- THEN the system MUST reject the operation.

#### Scenario: Status transitions follow the allowed paths

- GIVEN a visa document with status `requested`
- WHEN the traveler uploads the file
- THEN the status MUST become `uploaded`
- AND from `uploaded`, the agent MAY transition to `reviewed`, `processed`, or `re_upload_requested`.

### Requirement: Server-side-only storage access

Visa document files MUST be stored in a private storage area accessible only through server-side operations. The system MUST NOT expose direct public URLs to visa document files. All reads and downloads MUST go through an authenticated server-side endpoint that verifies the caller's authorization.

#### Scenario: No public URL exposed

- GIVEN a persisted visa document file
- WHEN any client-side code requests the file's location
- THEN the system MUST NOT return a direct public storage URL.

#### Scenario: Authenticated download through server endpoint

- GIVEN an authenticated agent with access to visa `V1`
- WHEN the agent requests to download a document belonging to `V1`
- THEN the system MUST serve the file through an authenticated server-side endpoint.

#### Scenario: Unauthenticated download denied

- GIVEN a visa document file
- WHEN an unauthenticated caller requests the file
- THEN the system MUST deny the request.

### Requirement: List documents for a visa

The system MUST allow an authenticated agent to list all documents (both agent-uploaded and traveler-requested) for a specific visa application, including each document's status and target traveler when applicable.

#### Scenario: Agent lists documents for a visa

- GIVEN an authenticated agent and a visa `V1` with three documents in mixed statuses
- WHEN the agent lists documents for `V1`
- THEN the system MUST return all three documents with their statuses and target travelers.

#### Scenario: Empty document list

- GIVEN a visa with no documents
- WHEN the agent lists documents for that visa
- THEN the system MUST return an empty list without error.

### Requirement: Dual-mode behavior parity

All visa-document operations MUST behave identically in Supabase mode and in mock mode. In mock mode, every mutation MUST update the in-memory mock state so that subsequent reads reflect the change.

#### Scenario: Mock upload is readable

- GIVEN Supabase is not configured
- WHEN an agent uploads a document to a visa
- THEN a subsequent list of that visa's documents MUST include the uploaded document.

#### Scenario: Mock status transition is reflected

- GIVEN Supabase is not configured and a visa document with status `uploaded`
- WHEN the agent marks it as `reviewed`
- THEN a subsequent read MUST show status `reviewed`.
