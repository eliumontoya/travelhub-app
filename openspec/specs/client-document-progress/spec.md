# Client Document Progress Specification

**Baseline**: baseline-from-current-implementation

## Purpose

Show the client their document completion progress per service and per-item status on the checklist.

## Requirements

### Requirement: Home progress counter

The client home page MUST display a per-service progress counter showing the number of completed items over the total checklist items.

#### Scenario: Counter reflects completed items

- GIVEN a service with 5 checklist items, 2 of which have status `processed`
- WHEN the client views the home page
- THEN the progress counter for that service shows "2/5"

#### Scenario: Counter updates after re-upload request

- GIVEN a service with 3 items: 1 `processed`, 1 `re_upload_requested`, 1 `pending`
- WHEN the client views the home page
- THEN the counter shows "1/3" (only `processed` counts as completed)

#### Scenario: Counter for service with no checklist

- GIVEN a service with zero checklist items
- WHEN the client views the home page
- THEN the counter shows "0/0" or the service section is hidden

### Requirement: Checklist item statuses

The checklist view MUST display each item with its current status using the following visual indicators:

| Status | Indicator | Description |
|--------|-----------|-------------|
| `pending` | No file icon | No file uploaded yet |
| `uploaded` | Clock/waiting icon | File uploaded, awaiting agent review |
| `processed` | ✓ (checkmark) | Agent processed; file removed from storage |
| `re_upload_requested` | ⚠ (warning) | Agent requested re-upload; comment visible |

#### Scenario: Pending item display

- GIVEN a checklist item with no upload
- WHEN the client views the checklist
- THEN the item shows a pending state with no file icon

#### Scenario: Uploaded item display

- GIVEN a checklist item with an upload in status `uploaded`
- WHEN the client views the checklist
- THEN the item shows a waiting indicator

#### Scenario: Processed item display

- GIVEN a checklist item with an upload in status `processed`
- WHEN the client views the checklist
- THEN the item shows a checkmark (✓) indicating completion

#### Scenario: Re-upload requested display with comment

- GIVEN a checklist item with status `re_upload_requested` and agent comment "File is blurry"
- WHEN the client views the checklist
- THEN the item shows a warning indicator (⚠) with the comment "File is blurry" visible

### Requirement: Progress is read-only for the client

The client MUST be able to view progress and statuses but MUST NOT be able to alter them directly. Status changes occur only through upload actions or agent review.

#### Scenario: Client cannot manually set status

- GIVEN a client viewing the checklist
- WHEN the client attempts to change an item's status without uploading a file
- THEN the operation is not available or is rejected
