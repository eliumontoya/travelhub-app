## MODIFIED Requirements

### Requirement: WCC scope isolation
The WCC shell MUST NOT implement contact, conversation, message, intent, or escalation mutations, MUST NOT expose raw messages as a top-level navigation item, and MUST NOT change inbound bot/webhook behavior. Knowledge entry create/edit/status management is the only WCC v1 WhatsApp data mutation surface.
(Previously: knowledge CRUD was also forbidden while earlier WCC slices were read-only.)

#### Scenario: Future sections remain scoped
- GIVEN the agent views WCC
- WHEN contacts, conversations, escalations, or knowledge are shown
- THEN contacts, conversations, escalations, messages, and intents MUST remain read-only operational views without manual WhatsApp response actions
- AND knowledge entries MAY expose create, edit, and status mutation controls.

### Requirement: WCC knowledge entries list
The system MUST render `/dashboard/wcc/knowledge` as an authenticated, paginated management view of WhatsApp knowledge entries with optional status filtering.

#### Scenario: Agent reviews knowledge entries
- GIVEN WhatsApp knowledge entries exist
- WHEN the agent opens `/dashboard/wcc/knowledge`
- THEN the system MUST show each entry topic, question, tags, source, status, approval timestamp when available, and update timestamp.

#### Scenario: Agent filters by status
- GIVEN entries exist with draft, approved, and archived statuses
- WHEN the agent applies a supported status filter
- THEN the system MUST limit the list to entries with that status.

#### Scenario: Knowledge list empty or unavailable
- GIVEN Supabase is unconfigured, WhatsApp data is absent, or the read fails
- WHEN the agent opens `/dashboard/wcc/knowledge`
- THEN the page MUST render a safe empty or unavailable state without throwing.

### Requirement: WCC knowledge entry mutations
The system MUST allow authenticated WCC users to create and edit WhatsApp knowledge entries with server-side validation for topic, question, answer, tags, source, and status.

#### Scenario: Agent creates valid knowledge
- GIVEN the agent submits topic, question, answer, optional tags, optional source, and a supported status
- WHEN validation succeeds
- THEN the system MUST create a `whatsapp_knowledge_entries` row
- AND approved entries MUST receive an approval timestamp.

#### Scenario: Invalid knowledge is rejected
- GIVEN the agent submits missing topic, missing question, missing answer, overlong content, or an unsupported status
- WHEN the Server Action handles the submission
- THEN the system MUST reject the mutation before writing to Supabase
- AND return validation feedback.

#### Scenario: Agent edits knowledge
- GIVEN an existing knowledge entry exists
- WHEN the agent submits valid updated fields
- THEN the system MUST update the row with normalized tags/source/status
- AND `approved_at` MUST be present only when the saved status is `approved`.

### Requirement: WCC knowledge status lifecycle
The system MUST allow authenticated WCC users to move knowledge entries among `draft`, `approved`, and `archived` without exposing delete controls.

#### Scenario: Agent approves knowledge
- GIVEN a draft or archived knowledge entry exists with valid content
- WHEN the agent changes its status to `approved`
- THEN the entry MUST become approved
- AND the inbound agent MAY use it because existing retrieval only loads approved entries.

#### Scenario: Agent archives obsolete knowledge
- GIVEN an approved or draft knowledge entry exists
- WHEN the agent changes its status to `archived`
- THEN the entry MUST become archived
- AND the inbound agent MUST NOT use it because existing retrieval filters to approved entries.
