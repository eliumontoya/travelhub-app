# Client Document Upload Specification

## Purpose

Allow the client to upload one file per checklist item, with re-upload replacing the previous file and its storage object.

## Requirements

### Requirement: One file per checklist item

The system SHALL allow the client to upload exactly one file per checklist item. Uploading a file for an item that already has one MUST replace the existing file (upsert behavior).

#### Scenario: First upload for an item

- GIVEN a checklist item with no prior upload
- WHEN the client uploads a file for that item
- THEN an upload record is created with status `uploaded` and the file is stored in the bucket under `services/{serviceId}/{checklistItemId}/`

#### Scenario: Re-upload replaces previous file

- GIVEN a checklist item already has an upload with a stored file at path P1
- WHEN the client uploads a new file for the same item
- THEN the upload record is updated to point to the new file at path P2
- AND the old storage object at path P1 is deleted from the bucket
- AND the upload status resets to `uploaded`

### Requirement: Server-side only storage access

The system MUST NOT expose raw storage objects or direct Supabase storage access to the client. All file reads and writes MUST be performed through server-side actions using the service role. Signed URLs, when needed, MUST be generated server-side.

#### Scenario: Client never receives a raw storage path

- GIVEN a client views their checklist with an uploaded file
- WHEN the client portal renders the file reference
- THEN the response contains no raw bucket path, no public URL, and no direct Supabase storage reference

#### Scenario: Client has no direct Supabase client access

- GIVEN the client portal is loaded in the browser
- WHEN the client attempts to interact with Supabase storage
- THEN no client-side Supabase storage call is made; all operations go through server actions

### Requirement: Upload belongs to the correct service and item

Each upload record MUST be linked to exactly one service and one checklist item. The system MUST reject uploads that reference a checklist item not belonging to the client's service.

#### Scenario: Upload for another client's item is rejected

- GIVEN client A's service has checklist item X
- WHEN client B attempts to upload a file referencing item X
- THEN the operation is rejected

### Requirement: File metadata is recorded

Each upload record MUST store at minimum: the file name, MIME type, storage path, upload timestamp, and current status.

#### Scenario: Upload record contains required metadata

- GIVEN a client uploads a file named "passport.pdf" with MIME type `application/pdf`
- WHEN the upload completes
- THEN the upload record stores the file name, MIME type, storage path, timestamp, and status `uploaded`
