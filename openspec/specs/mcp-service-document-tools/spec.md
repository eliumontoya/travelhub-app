# MCP Service-Document Tools Specification

## Purpose

Expose TravelHub's service-document domain to an external agent through the MCP server. The tools allow the agent to list a trip's services, inspect checklists and upload status, obtain a signed download URL for a document, and transition uploads between `uploaded`, `reviewed`, `processed`, and `re_upload_requested` statuses.

## Requirements

### Requirement: List services for a trip

The `list_services` tool MUST return the list of services belonging to the caller-supplied trip, including each service's identifier.

#### Scenario: List services

- GIVEN a trip with one or more services
- WHEN the agent calls `list_services` with the trip's id
- THEN the result contains the trip's services
- AND each service includes its id

#### Scenario: Trip with no services

- GIVEN a trip with no services
- WHEN the agent calls `list_services` with the trip's id
- THEN the result is an empty list

### Requirement: Get service checklist without signed URLs

The `get_service_checklist` tool MUST return a service's checklist items and their uploads, exposing each upload's `filePath`, `status`, and `fileRemoved`. The tool MUST NOT embed signed download URLs in its output.

#### Scenario: Checklist exposes upload status

- GIVEN a service with checklist items whose uploads are in various statuses
- WHEN the agent calls `get_service_checklist` for that service
- THEN each item exposes its upload's `filePath`, `status`, and `fileRemoved`
- AND the agent can determine which items are pending, reviewed, or processed

#### Scenario: No signed URLs in checklist

- GIVEN a service with checklist items that have uploads
- WHEN the agent calls `get_service_checklist` for that service
- THEN the result does not include signed download URLs

### Requirement: Get service document summaries

The `get_service_document_summaries` tool MUST return compact per-trip counts of processed, total, and awaiting-review uploads, so the agent can determine remaining work without fetching full checklists.

#### Scenario: Summaries reflect processing state

- GIVEN a trip whose services have a mix of `uploaded` and `processed` uploads
- WHEN the agent calls `get_service_document_summaries` for the trip
- THEN the result exposes processed and total counts
- AND the awaiting-review count reflects uploads not yet processed

### Requirement: Get signed download URL

The `get_service_upload_download_url` tool MUST return a signed download URL for a service-document `filePath` obtained from the checklist output. The URL MUST be generated with the service role so it is a valid download token for the private bucket.

#### Scenario: Obtain a signed download URL

- GIVEN a service upload with a known `filePath` in the private documents bucket
- WHEN the agent calls `get_service_upload_download_url` with that `filePath`
- THEN the result contains a `url` the agent can use to download the file
- AND the result includes the URL's expiration (`expiresIn`)

#### Scenario: Download the file with the signed URL

- GIVEN a signed URL returned by `get_service_upload_download_url`
- WHEN the agent fetches the URL
- THEN the file bytes are returned

### Requirement: Process a service upload

The `process_service_upload` tool MUST transition an upload to `processed`. When processing, the system MUST delete the physical file from Storage, MUST retain the database record, and MUST set `status = "processed"` and `file_removed = true` on the record. Archived trips MUST reject this mutation, and the upload MUST belong to the caller-supplied trip.

#### Scenario: Process an uploaded file

- GIVEN an upload with status `uploaded` and a file stored at path P, belonging to the caller-supplied trip
- WHEN the agent calls `process_service_upload` for that upload
- THEN the upload status changes to `processed`
- AND the physical file at path P is deleted from the bucket
- AND the database record is retained
- AND `file_removed` is set to `true`

#### Scenario: Processed upload retains no file

- GIVEN an upload with status `processed` and `file_removed = true`
- WHEN the agent inspects the checklist
- THEN the item shows as processed with no downloadable file

### Requirement: Mark service upload reviewed

The `mark_service_upload_reviewed` tool MUST transition an upload to `reviewed`. Archived trips MUST reject this mutation, and the upload MUST belong to the caller-supplied trip.

#### Scenario: Mark upload reviewed

- GIVEN an upload with status `uploaded` belonging to the caller-supplied trip
- WHEN the agent calls `mark_service_upload_reviewed` for that upload
- THEN the upload status changes to `reviewed`

### Requirement: Request service upload re-upload

The `request_service_upload_reupload` tool MUST transition an upload to `re_upload_requested` with a non-empty comment explaining the reason. The original file MUST remain in storage. Archived trips MUST reject this mutation, and the upload MUST belong to the caller-supplied trip.

#### Scenario: Request re-upload with comment

- GIVEN an upload with status `uploaded` belonging to the caller-supplied trip
- WHEN the agent calls `request_service_upload_reupload` with a non-empty comment
- THEN the upload status changes to `re_upload_requested`
- AND the comment is stored on the upload
- AND the original file remains in storage

#### Scenario: Reject empty comment

- GIVEN an upload with status `uploaded`
- WHEN the agent calls `request_service_upload_reupload` with an empty comment
- THEN the operation is rejected

### Requirement: Ownership and archived-trip guard for mutations

Each mutation tool (`process_service_upload`, `mark_service_upload_reviewed`, `request_service_upload_reupload`) MUST verify that the upload belongs to the caller-supplied trip and MUST reject the operation when the upload's trip is archived.

#### Scenario: Reject archived trip mutation

- GIVEN an upload whose trip is archived
- WHEN the agent calls any mutation tool for that upload
- THEN the operation is rejected
- AND the upload remains unchanged

#### Scenario: Reject upload from a different trip

- GIVEN an upload that belongs to trip A
- WHEN the agent calls a mutation tool with the upload's id and trip B's id
- THEN the operation is rejected
- AND the upload remains unchanged

### Requirement: Tool results never leak secrets or internals

MCP tool results MUST use a structured success/error envelope. Error results MUST NOT expose stack traces, database identifiers beyond the documented output, or the service-role/API credentials.

#### Scenario: Error result is sanitized

- GIVEN a tool invocation that fails
- WHEN the server returns the error result
- THEN the result contains an actionable message
- AND no stack trace or credential is exposed
