# Delta for Client Document Upload

## ADDED Requirements

### Requirement: Document portal trip navigation

The client document portal at `/client/trips/{id}/documents` SHALL provide a clear link back to the linked trip page for the same trip. The link MUST preserve client-facing access boundaries and MUST NOT expose an agent-only dashboard URL.

#### Scenario: Client opens linked trip from document portal

- GIVEN an authenticated client is viewing `/client/trips/{id}/documents` for one of their assigned trips
- WHEN the page renders
- THEN a visible link to the linked trip page is available
- AND activating the link takes the client to the client-facing trip experience for that trip

#### Scenario: Link does not expose dashboard route

- GIVEN an authenticated client is viewing their document portal
- WHEN the linked trip control renders
- THEN the target MUST NOT be an agent-only `/dashboard/**` URL

#### Scenario: Missing or unavailable trip link degrades gracefully

- GIVEN the trip cannot produce a client-facing trip destination
- WHEN the document portal renders
- THEN the page MUST remain usable for document upload
- AND it MUST NOT render a broken or misleading trip link
