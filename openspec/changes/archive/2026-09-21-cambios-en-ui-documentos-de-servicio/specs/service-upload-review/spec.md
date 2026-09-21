# Delta for Service Upload Review

**Baseline**: baseline-from-current-implementation

## MODIFIED Requirements

### Requirement: Agent marks upload as processed

The agent MUST be able to mark an upload as `processed` on draft or published trips, independently of itinerary editability. When an upload is marked processed, the system MUST physically remove the file from storage and set `file_removed = true` on the upload record. Archived trips MUST reject this mutation.
(Previously: The agent could mark an upload as processed without defining trip lifecycle availability.)

#### Scenario: Mark upload as processed

- GIVEN an upload with status `uploaded` and a file stored at path P
- WHEN the agent marks the upload as `processed`
- THEN the upload status changes to `processed`
- AND the file at path P is deleted from the bucket
- AND `file_removed` is set to `true` on the upload record

#### Scenario: Processed upload shows no file to client

- GIVEN an upload with status `processed` and `file_removed = true`
- WHEN the client views the checklist
- THEN the item displays as completed (✓) with no file download available

#### Scenario: Review published trip upload

- GIVEN an upload with status `uploaded` belongs to a published trip
- WHEN the agent marks it as processed
- THEN the transition succeeds

#### Scenario: Reject archived trip review

- GIVEN an upload belongs to an archived trip
- WHEN the agent marks it as processed
- THEN the operation is rejected and the upload remains unchanged

### Requirement: Agent requests re-upload with comment

The agent MUST be able to mark an upload as `re_upload_requested` on draft or published trips, independently of itinerary editability. This transition MUST include a non-empty `agent_comment` explaining the reason. Archived trips MUST reject this mutation.
(Previously: The agent could request re-upload without defining trip lifecycle availability.)

#### Scenario: Request re-upload with comment

- GIVEN an upload with status `uploaded`
- WHEN the agent marks it as `re_upload_requested` with comment “Scan is blurry, please re-upload in color”
- THEN the upload status changes to `re_upload_requested`
- AND the `agent_comment` is stored and visible to the client
- AND the original file remains in storage (not deleted)

#### Scenario: Re-upload request without comment is rejected

- GIVEN an upload with status `uploaded`
- WHEN the agent attempts to mark it as `re_upload_requested` with an empty comment
- THEN the operation is rejected

#### Scenario: Client views re-upload request with comment

- GIVEN an upload has status `re_upload_requested` and comment “Scan is blurry”
- WHEN the client views the checklist
- THEN the item displays a warning indicator (⚠) with the agent’s comment visible
- AND the client can upload a replacement file for that item

#### Scenario: Client re-uploads after re-upload request

- GIVEN an upload has status `re_upload_requested`
- WHEN the client uploads a new file for that item
- THEN the upload status resets to `uploaded`
- AND the old storage object is deleted from the bucket
- AND the `agent_comment` is cleared

### Requirement: Only agent can transition upload status

The system MUST NOT allow the client to change an upload's status. Only agent-facing actions MAY transition uploads between `uploaded`, `processed`, and `re_upload_requested`.

#### Scenario: Client cannot mark upload as processed

- GIVEN a client has an upload in status `uploaded`
- WHEN the client attempts to set the status to `processed`
- THEN the operation is rejected

## ADDED Requirements

### Requirement: Agent receives upload review counts

The dashboard MUST expose each traveler's processed/total count and uploads awaiting agent review. Only `uploaded` status SHALL count as awaiting review; `re_upload_requested` MUST remain excluded.

#### Scenario: Show review workload

- GIVEN a traveler has five items, three processed uploads, and one `uploaded` item
- WHEN the dashboard renders the traveler summary
- THEN it shows `3/5` processed and `1` awaiting review
