## ADDED Requirements

### Requirement: WCC contacts list
The system MUST render `/dashboard/wcc/contacts` as a read-only, paginated list of WhatsApp contacts ordered by recent activity using `last_message_at` with a safe fallback to creation time.

#### Scenario: Agent identifies recent sender
- GIVEN WhatsApp contacts exist
- WHEN the agent opens `/dashboard/wcc/contacts`
- THEN the system MUST show each contact phone, display/profile name, linked TravelHub client when available, opt-in status, and last activity.

#### Scenario: Agent opens contact detail
- GIVEN a contact appears in the WCC contacts list
- WHEN the agent selects that contact
- THEN the system MUST navigate to `/dashboard/wcc/contacts/[id]` for that contact.

#### Scenario: Contacts list empty or unavailable
- GIVEN Supabase is unconfigured, WhatsApp data is absent, or the read fails
- WHEN the agent opens `/dashboard/wcc/contacts`
- THEN the page MUST render a safe empty or unavailable state without throwing.

### Requirement: WCC contact detail
The system MUST render `/dashboard/wcc/contacts/[id]` as a read-only contact profile with the contact identity, optional linked TravelHub client, and related conversations, escalations, and intents as operational context.

#### Scenario: Contact has related context
- GIVEN a WhatsApp contact has conversations, escalations, or intents
- WHEN the agent opens the contact detail
- THEN the system MUST show limited related context for those records without enabling mutations.

#### Scenario: Contact is missing
- GIVEN a contact id does not exist or cannot be read
- WHEN the agent opens `/dashboard/wcc/contacts/[id]`
- THEN the system MUST show a safe not-found or unavailable state.
