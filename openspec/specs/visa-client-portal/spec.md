# Visa Client Portal Specification

## Purpose

Provide a traveler-facing surface where an authenticated traveler can see the visa applications they are assigned to and upload documents for a specific visa application. The portal mirrors the existing trip document portal but is scoped to the `visas` domain.

## Requirements

### Requirement: Traveler visa list

The system MUST allow an authenticated traveler to view a list of the visa applications they are assigned to. The list MUST include each visa's country, visa type, deadline, and current status. The traveler MUST NOT see visa applications they are not assigned to.

#### Scenario: Traveler sees their assigned visas

- GIVEN an authenticated traveler assigned to visas `V1` and `V2`
- WHEN the traveler opens the visa portal
- THEN the system MUST display `V1` and `V2` with their country, visa type, deadline, and current status.

#### Scenario: Traveler does not see unassigned visas

- GIVEN an authenticated traveler assigned to visa `V1` but not `V3`
- WHEN the traveler opens the visa portal
- THEN the list MUST NOT include `V3`.

#### Scenario: Empty list when traveler has no visas

- GIVEN an authenticated traveler with no visa assignments
- WHEN the traveler opens the visa portal
- THEN the system MUST display an empty list without error.

### Requirement: Traveler uploads documents for a visa

The system MUST allow an authenticated traveler to upload documents for a specific visa application they are assigned to, at the route `/client/visas/[id]/documents`. The traveler MUST only be able to upload to visas they are assigned to.

#### Scenario: Traveler uploads a document for an assigned visa

- GIVEN an authenticated traveler assigned to visa `V1`
- WHEN the traveler uploads a file at `/client/visas/V1/documents`
- THEN the system MUST persist the upload as a visa document for `V1`
- AND the document status MUST reflect the upload.

#### Scenario: Traveler cannot upload for an unassigned visa

- GIVEN an authenticated traveler not assigned to visa `V3`
- WHEN the traveler attempts to upload a file at `/client/visas/V3/documents`
- THEN the system MUST deny the upload.

#### Scenario: Unauthenticated upload denied

- GIVEN no authenticated traveler
- WHEN an upload is attempted at `/client/visas/V1/documents`
- THEN the system MUST deny the request.

### Requirement: Traveler sees pending document requests

The system MUST show the traveler any document requests the agent has made for a specific visa application, including the document description and current status (e.g. `requested`, `re_upload_requested`).

#### Scenario: Traveler sees a pending document request

- GIVEN an authenticated traveler assigned to visa `V1` with a document request of status `requested`
- WHEN the traveler opens `/client/visas/V1/documents`
- THEN the system MUST display the pending request with its description and status.

#### Scenario: Traveler sees a re-upload request

- GIVEN a visa document with status `re_upload_requested` targeting the traveler
- WHEN the traveler opens the visa's document page
- THEN the system MUST display the re-upload request so the traveler can upload a replacement.

### Requirement: Visa summary on client home

The system MUST display the traveler's visa applications and their current status on the client home page, alongside the existing trip information.

#### Scenario: Client home shows visa summary

- GIVEN an authenticated traveler with two visa applications in different statuses
- WHEN the traveler opens the client home page
- THEN the system MUST display both visa applications with their current status.

#### Scenario: Client home with no visas

- GIVEN an authenticated traveler with no visa assignments
- WHEN the traveler opens the client home page
- THEN the client home MUST render without error and without a visa section, or with an explicit "no visa applications" indicator.

### Requirement: Portal authorization

All client-portal visa operations MUST require an authenticated traveler. The portal MUST scope every read and write to visa applications the traveler is assigned to.

#### Scenario: Authenticated traveler accesses portal

- GIVEN an authenticated traveler
- WHEN the traveler accesses `/client/visas`
- THEN the system MUST allow access.

#### Scenario: Unauthenticated access denied

- GIVEN no authenticated traveler
- WHEN a request is made to `/client/visas`
- THEN the system MUST deny access.

#### Scenario: Portal scopes to assigned visas only

- GIVEN an authenticated traveler assigned to `V1`
- WHEN the traveler requests details for `V2` (not assigned)
- THEN the system MUST deny the request.
