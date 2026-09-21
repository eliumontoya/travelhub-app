# Delta for Client Document Upload

## MODIFIED Requirements

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
