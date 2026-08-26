# Exploration: WhatsApp inbound data foundation (issue #199)

## Inputs read

- GitHub issue #199: `feat(whatsapp): create inbound data foundation`.
- Epic #198: WhatsApp inbound agent architecture and staged phase list.
- `project.md`, `architecture.md`, `openspec/config.yaml`.
- Supabase RLS/current changelog and local Supabase/Postgres best-practice skills.
- Local Next.js 16.2.10 docs: Route Handlers, Backend for Frontend, Data Security.

> Note: `doc/whatsapp-inbound-agent-architecture.md` is referenced by #198/#199 but is not present in this worktree. The entity model below is inferred from the epic/issue text and the documented component list (`webhook route`, normalizer, store, WhatsApp API client, LLM agent, escalation service, `src/lib/whatsapp/inbound-service.ts`).

## Current state

TravelHub already stores the core CRM entities (`clients`, `trips`, itinerary data) in Supabase. There are no WhatsApp inbound tables yet, no webhook ingestion, no LLM decisioning, and no external CRM sync queue. The current app is mono-user: one authenticated travel agent can manage all internal data; public/anon access is intentionally limited to published trip surfaces.

## Proposed entities and key fields

| Entity | Purpose | Key fields | Relationships | Lifecycle/status fields | Why it exists |
|---|---|---|---|---|---|
| `whatsapp_contacts` | Canonical person/phone identity for WhatsApp senders before or after CRM/client matching. | `phone_e164` unique, `whatsapp_profile_name`, `display_name`, `linked_client_id`, `opt_in_status`, timestamps. | Optional `linked_client_id -> clients.id`. Parent of conversations/messages/intents/escalations. | `opt_in_status` (`unknown`, `pending`, `opted_in`, `opted_out`), `first_seen_at`, `last_seen_at`, `last_message_at`. | Keeps phone identity stable even if multiple conversations happen before the agent links the person to a TravelHub client. |
| `whatsapp_conversations` | Thread-level state for an inbound WhatsApp interaction. | `contact_id`, `status`, `channel`, `last_message_at`, `last_inbound_at`, `last_outbound_at`, `last_intent`, `assigned_trip_id`. | `contact_id -> whatsapp_contacts.id`, optional `assigned_trip_id -> trips.id`; parent of messages/intents/escalations. | `status` (`open`, `awaiting_agent`, `escalated`, `resolved`, `archived`), `closed_at`. | Gives the future orchestrator a single row to decide whether a thread is active, resolved, escalated, or linked to a trip. |
| `whatsapp_messages` | Idempotent immutable-ish ledger of inbound/outbound WhatsApp messages. | `whatsapp_message_id` unique, `direction`, `message_type`, `body`, `media`, `payload`, `occurred_at`. | `conversation_id -> whatsapp_conversations.id`, `contact_id -> whatsapp_contacts.id`. | `status` (`received`, `processed`, `responded`, `escalated`, `failed`, `sent`), `processed_at`. | Webhook ingestion can dedupe by Meta message id and later phases can audit exactly what the agent saw or sent. |
| `whatsapp_intents` | Structured understanding extracted from a message/conversation. | `intent_type`, `confidence`, `entities`, `summary`. | `conversation_id`, `message_id`, `contact_id`. | `status` (`detected`, `confirmed`, `dismissed`, `synced`), `detected_at`. | Separates raw text from CRM/actionable meaning so the LLM decisioning phase can be reviewed and synchronized. |
| `whatsapp_escalations` | Human handoff/work queue when automation is unsafe or insufficient. | `reason`, `priority`, `summary`, `assigned_to`. | `conversation_id`, `contact_id`, optional `message_id`, optional `intent_id`. | `status` (`open`, `acknowledged`, `resolved`, `canceled`), `opened_at`, `resolved_at`. | Makes escalation explicit instead of burying it in message status, allowing later dashboard/ops views. |
| `whatsapp_knowledge_entries` | Approved Q&A/business knowledge available to the future inbound agent. | `topic`, `question`, `answer`, `tags`, `source`. | Independent catalog; future intents/messages may reference it later. | `status` (`draft`, `approved`, `archived`), `approved_at`, timestamps. | Keeps agent-answerable knowledge curated and separable from conversations; only approved entries should power autonomous answers. |
| `crm_sync_events` | Durable staging queue for external CRM synchronization. | `source_table`, `source_id`, `event_type`, `aggregate_type`, `aggregate_id`, `event_key`, `payload`, `attempts`, `last_error`, `available_at`. | References source rows by table/id without tight FK coupling, because external sync may consume multiple domains over time. | `status` (`pending`, `processing`, `processed`, `failed`), `processed_at`, timestamps. | Decouples TravelHub writes from CRM side effects, supports retries, and lets external processors read pending work without implementing CRM calls inside WhatsApp ingestion. |

## Relationship sketch

```text
clients  <--- optional link --- whatsapp_contacts
trips    <--- optional link --- whatsapp_conversations

whatsapp_contacts
  └── whatsapp_conversations
        ├── whatsapp_messages
        ├── whatsapp_intents
        └── whatsapp_escalations

whatsapp_knowledge_entries  (approved catalog for future agent decisioning)
crm_sync_events             (generic outbound staging queue)
```

## Alternatives considered

### 1. Store everything in `whatsapp_messages.payload` JSONB

Rejected. JSON-only storage is flexible but makes dedupe, status dashboards, escalation queues, and CRM event processing harder to index and reason about. The foundation needs relational anchors for contacts, conversations, messages, intents, escalations, and knowledge.

### 2. Merge `whatsapp_contacts` into existing `clients`

Rejected. Not every WhatsApp sender is a known TravelHub client yet; multiple phones may map to one real client later; and the automation needs an inbound identity even before CRM hygiene is complete. `linked_client_id` keeps the bridge optional.

### 3. Put `crm_sync_events` inside only `whatsapp-inbound-automation`

Partially rejected. The table is implemented in the same issue because #199 requires CRM staging, but OpenSpec should model it as its own capability (`crm-sync-staging`). Reason: the queue is reusable for future non-WhatsApp CRM events and its observable behavior (pending/processed/failed retries) is different from WhatsApp conversation automation.

### 4. Create Postgres enum types for statuses

Rejected for this phase. The existing schema generally uses `text check (...)` constraints. Following that pattern keeps migrations simple, avoids enum-alter friction, and still enforces valid lifecycle values.

### 5. Grant direct anon read to pending CRM events for an external processor

Rejected. Issue #199 explicitly says no anon exposure. External processors should use a server-side/service-role key or a later dedicated secure integration mechanism. `authenticated` remains the mono-admin role for internal access.

## Security and RLS posture

- Every new public-schema table enables and forces RLS.
- `anon` receives no grants.
- `authenticated` receives admin CRUD grants protected by a mono-user policy requiring a real authenticated user id.
- Server-side/webhook writes in later phases will use the Supabase service role, which bypasses RLS and must remain server-only.
- No public dashboard/UI/API exposure is introduced in this issue.

## Implementation boundary for issue #199

In scope:
- Supabase migration with seven tables, constraints, RLS/grants, and indexes.
- TypeScript domain contracts for the new rows/statuses.
- OpenSpec specs for WhatsApp inbound automation and CRM staging.
- Verification tests for the schema contract.

Out of scope:
- Meta webhook route and signature validation.
- WhatsApp sending client.
- LLM agent and decision prompts.
- Orchestration in `src/lib/whatsapp/inbound-service.ts`.
- Dashboard UI for conversations/escalations/knowledge.
