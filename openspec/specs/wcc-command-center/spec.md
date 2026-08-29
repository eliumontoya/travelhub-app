# WCC Command Center Specification

**Baseline**: baseline-from-current-implementation

## Purpose
Provide an authenticated WhatsApp Command Control shell for monitoring WhatsApp operations without changing inbound bot behavior.

## Requirements

### Requirement: Authenticated WCC navigation entry
The system MUST expose `WhatsApp C.C.` from the authenticated TravelHub dashboard nav and link it to `/dashboard/wcc` without removing existing destinations.

#### Scenario: Agent opens WCC
- GIVEN an authenticated agent is inside `/dashboard`
- WHEN they use `WhatsApp C.C.`
- THEN the app MUST navigate to `/dashboard/wcc`.

### Requirement: Dedicated WCC shell
The system MUST render `/dashboard/wcc` with WCC navigation and a `TravelHub` link back to `/dashboard`.

#### Scenario: Agent returns to TravelHub
- GIVEN the agent is viewing `/dashboard/wcc`
- WHEN they use `TravelHub`
- THEN the app MUST navigate to `/dashboard`.

### Requirement: WCC operational dashboard
The system MUST render read-only KPIs for open escalations, recent conversations, recent contacts, knowledge entries by status, and pending/failed messages when data exists.

#### Scenario: Render without data
- GIVEN Supabase is not configured or WhatsApp rows are absent
- WHEN the agent opens `/dashboard/wcc`
- THEN the dashboard MUST render zero counts and empty states without errors.

### Requirement: WCC scope isolation
The WCC shell MUST NOT implement contact, conversation, message, intent, or escalation mutations, MUST NOT expose raw messages as a top-level navigation item, and MUST NOT change inbound bot/webhook behavior. Knowledge entry create/edit/status management is the only WCC v1 WhatsApp data mutation surface.

#### Scenario: Future sections remain scoped
- GIVEN the agent views WCC
- WHEN contacts, conversations, escalations, or knowledge are shown
- THEN contacts, conversations, escalations, messages, and intents MUST remain read-only operational views without manual WhatsApp response actions
- AND knowledge entries MAY expose create, edit, and status mutation controls.


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

### Requirement: WCC escalations queue
The system MUST render `/dashboard/wcc/escalations` as a read-only queue of WhatsApp escalations ordered by newest `opened_at` first.

#### Scenario: Agent triages recent escalation
- GIVEN WhatsApp escalations exist
- WHEN the agent opens `/dashboard/wcc/escalations`
- THEN the system MUST show each escalation reason or summary, priority, status, related contact identity, opened date, and related context links.

#### Scenario: Agent filters queue
- GIVEN escalations exist with different statuses and priorities
- WHEN the agent applies a supported status or priority filter
- THEN the system MUST limit the queue to matching escalations without enabling mutation controls.

#### Scenario: Escalations empty or unavailable
- GIVEN Supabase is unconfigured, WhatsApp data is absent, or the read fails
- WHEN the agent opens `/dashboard/wcc/escalations`
- THEN the page MUST render a safe empty or unavailable state without throwing.

### Requirement: WCC conversations list
The system MUST render `/dashboard/wcc/conversations` as a read-only, paginated list of WhatsApp conversations grouped by conversation thread and ordered by recent `last_message_at` with a safe fallback to creation time.

#### Scenario: Agent reviews recent conversations
- GIVEN WhatsApp conversations exist
- WHEN the agent opens `/dashboard/wcc/conversations`
- THEN the system MUST show each conversation contact identity, status, last intent, latest inbound context, latest outbound context, and last activity.

#### Scenario: Agent opens conversation detail
- GIVEN a conversation appears in the WCC conversations list
- WHEN the agent selects that conversation
- THEN the system MUST navigate to `/dashboard/wcc/conversations/[id]` for that conversation.

#### Scenario: Conversations empty or unavailable
- GIVEN Supabase is unconfigured, WhatsApp data is absent, or the read fails
- WHEN the agent opens `/dashboard/wcc/conversations`
- THEN the page MUST render a safe empty or unavailable state without throwing.

### Requirement: WCC conversation timeline
The system MUST render `/dashboard/wcc/conversations/[id]` as a read-only conversation profile with contact identity, conversation status, related messages, and related intents as timeline context.

#### Scenario: Conversation has related messages and intents
- GIVEN a WhatsApp conversation has messages or intents
- WHEN the agent opens the conversation detail
- THEN the system MUST show timeline entries with message direction, status, body or fallback type, occurred date, processed date when available, and related intent summaries when present.

#### Scenario: Conversation detail is missing
- GIVEN a conversation id does not exist or cannot be read
- WHEN the agent opens `/dashboard/wcc/conversations/[id]`
- THEN the system MUST show a safe not-found or unavailable state.

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
