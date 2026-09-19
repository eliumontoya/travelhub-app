# Service Upload Review Specification

## Purpose

Allow the agent to review uploaded files and transition them to `processed` or `re_upload_requested` status.

## Requirements

### Requirement: Agent marks upload as processed

The agent MUST be able to mark an upload as `processed`. When an upload is marked processed, the system MUST physically remove the file from storage and set `file_removed = true` on the upload record.

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

### Requirement: Agent requests re-upload with comment

The agent MUST be able to mark an upload as `re_upload_requested`. This transition MUST include a non-empty `agent_comment` explaining the reason.

#### Scenario: Request re-upload with comment

- GIVEN an upload with status `uploaded`
- WHEN the agent marks it as `re_upload_requested` with comment "Scan is blurry, please re-upload in color"
- THEN the upload status changes to `re_upload_requested`
- AND the `agent_comment` is stored and visible to the client
- AND the original file remains in storage (not deleted)

#### Scenario: Re-upload request without comment is rejected

- GIVEN an upload with status `uploaded`
- WHEN the agent attempts to mark it as `re_upload_requested` with an empty comment
- THEN the operation is rejected

### Requirement: Client sees agent comment after re-upload request

When an upload is in `re_upload_requested` status, the client MUST see the agent's comment and be able to upload a replacement file.

#### Scenario: Client views re-upload request with comment

- GIVEN an upload with status `re_upload_requested` and comment "Scan is blurry"
- WHEN the client views the checklist
- THEN the item displays a warning indicator (⚠) with the agent's comment visible
- AND the client can upload a replacement file for that item

#### Scenario: Client re-uploads after re-upload request

- GIVEN an upload with status `re_upload_requested`
- WHEN the client uploads a new file for that item
- THEN the upload status resets to `uploaded`
- AND the old storage object is deleted from the bucket
- AND the `agent_comment` is cleared

### Requirement: Only agent can transition upload status

The system MUST NOT allow the client to change an upload's status. Only agent-facing actions MAY transition uploads between `uploaded`, `processed`, and `re_upload_requested`.

#### Scenario: Client cannot mark upload as processed

- GIVEN a client with an upload in status `uploaded`
- WHEN the client attempts to set the status to `processed`
- THEN the operation is rejected
