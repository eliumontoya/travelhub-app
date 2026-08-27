# Exploration: Issue 209 Controlled TravelHub Tools

## Issue
GitHub #209 asks for controlled, typed tools that let the WhatsApp inbound agent consult dynamic TravelHub data without direct SQL, Supabase credentials, or broad table access by the LLM.

## Current State
- WhatsApp inbound foundation exists: `whatsapp_contacts.linked_client_id`, conversations, messages, intents, escalations, knowledge entries, and `crm_sync_events`.
- Inbound decisioning currently uses approved static knowledge only.
- Orchestration persists decisions and escalations, but no dynamic tool router exists.
- TravelHub domain data includes `clients`, `trips`, `trip_clients`, `trip_days`, `items`, item-level `documents`, global `trip_documents`, and private `client_documents`.
- No payment table exists in the current schema, so payment status cannot be safely answered from system-of-record data yet.

## Relevant Constraints
- The LLM must never generate SQL or receive Supabase keys.
- Every trip-scoped tool must verify the requested `tripId` belongs to the `clientId` resolved from the WhatsApp phone/contact.
- Results passed back to the agent must be small, structured, and safe.
- Ambiguity and unavailable/sensitive data should return a safe non-answer outcome that the agent can use to clarify or escalate.
- Tool-call audit can reuse `crm_sync_events` rather than adding a new table in this slice.

## Recommended Slice
Implement a server-side controlled tool module at `src/lib/ai/tools/travelhub-client-tools.ts` with:
- Typed tool names, input/output contracts, and an allowlisted router.
- Client resolution by WhatsApp phone through `whatsapp_contacts.linked_client_id`, with exact client-phone fallback.
- Active/recent trip listing and ownership checks.
- Safe trip summary, itinerary/document status summaries, and payment status safe escalation.
- Optional audit event creation in `crm_sync_events` with sanitized payloads.

## Out of Scope
- Feeding tool calls into the live LLM loop.
- New payment schema or business policy decisions.
- UI for tool management.
- Direct customer document downloads or signed URLs.
