# Client Document Upload Specification

**Baseline**: baseline-from-current-implementation

## Purpose

Allow the client to upload one file per checklist item, with re-upload replacing the previous file and its storage object.

## Requirements

### Requirement: One file per checklist item

The system SHALL allow the client to upload exactly one file per checklist item. Uploading a file for an item that already has one MUST replace the existing file (upsert behavior). A newly uploaded storage object MUST be treated as provisional until its upload record is persisted successfully. If persistence fails, the system MUST attempt to remove only that newly uploaded object and MUST reject the operation. The system MUST NOT claim atomicity between database persistence and storage cleanup. If the compensating cleanup also fails, the operation MUST report both the persistence failure and the cleanup failure, and MUST make the incomplete cleanup and resulting orphan risk explicit.

(Previously: A failed persistence operation had no specified compensation or error-reporting guarantee for the newly uploaded storage object.)

#### Scenario: First upload for an item

- GIVEN a checklist item with no prior upload
- WHEN the client uploads a file for that item and the upload record is persisted successfully
- THEN an upload record is created with status `uploaded` and the file is stored in the bucket under `services/{serviceId}/{checklistItemId}/`

#### Scenario: Re-upload replaces previous file

- GIVEN a checklist item already has an upload with a stored file at path P1
- WHEN the client uploads a new file for the same item and the upload record is persisted successfully
- THEN the upload record is updated to point to the new file at path P2
- AND the old storage object at path P1 is deleted from the bucket only after the record points to P2
- AND the upload status resets to `uploaded`

#### Scenario: Failed first-upload persistence compensates the new object

- GIVEN a checklist item has no prior upload
- WHEN the new file is stored successfully but persistence of its upload record fails
- THEN the operation is rejected
- AND the system attempts to remove only the newly uploaded object
- AND no successful upload is reported

#### Scenario: Failed replacement preserves the existing upload

- GIVEN a checklist item already has an upload record that references storage path P1
- WHEN a replacement file is stored at path P2 but persistence of the replacement record fails
- THEN the operation is rejected
- AND the existing upload record and its reference to P1 remain unchanged
- AND the system attempts to remove P2
- AND the storage object at P1 is not deleted as compensation for the failed replacement

#### Scenario: Cleanup failure is reported honestly

- GIVEN a new file is stored at path P2 and persistence of its upload record fails
- AND the compensating removal of P2 also fails
- WHEN the failed operation is returned to the client
- THEN the operation is rejected
- AND the reported failure retains both the original persistence failure and the cleanup failure
- AND the response explicitly indicates that cleanup is incomplete and P2 may remain orphaned
- AND the response MUST NOT present the operation as successful or as an atomic rollback
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
