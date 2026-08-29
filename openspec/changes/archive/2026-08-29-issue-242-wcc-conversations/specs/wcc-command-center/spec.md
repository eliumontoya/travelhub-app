## MODIFIED Requirements

### Requirement: WCC scope isolation
The WCC shell MUST NOT implement knowledge CRUD, manual response actions, or raw messages as a top-level navigation item, and MUST NOT change inbound bot/webhook behavior.

#### Scenario: Future sections remain scoped
- GIVEN the agent views WCC
- WHEN contacts, conversations, escalations, or knowledge are shown
- THEN those entries MUST be read-only operational views or placeholders, without knowledge CRUD or manual WhatsApp response actions.

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
