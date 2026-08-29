# Delta for WCC Command Center

## MODIFIED Requirements

### Requirement: WCC contacts list
The system MUST render `/dashboard/wcc/contacts` as a read-only, paginated contacts list ordered by recent activity. When a contact is persistently linked to a TravelHub client, the list MUST show that client.
(Previously: auto-link persistence was not required.)

#### Scenario: Agent identifies recent sender
- GIVEN WhatsApp contacts exist
- WHEN the agent opens `/dashboard/wcc/contacts`
- THEN the system MUST show identity, linked client when available, opt-in, and last activity.

#### Scenario: Agent sees auto-linked client
- GIVEN a contact phone uniquely matches a client WhatsApp after normalization
- WHEN the agent opens `/dashboard/wcc/contacts`
- THEN the linked client MUST come from persisted contact data.

### Requirement: WCC contact detail
The system MUST render `/dashboard/wcc/contacts/[id]` with contact identity, optional linked TravelHub client, and related operational context. Deterministic links MUST load through `whatsapp_contacts.linked_client_id`.
(Previously: the detail page displayed optional links but did not require auto-materialization.)

#### Scenario: Contact has auto-linked client
- GIVEN a contact uniquely matches a TravelHub client
- WHEN the agent opens contact detail
- THEN “Cliente TravelHub vinculado” MUST show and link to that client.
