# Design: WhatsApp response orchestration and escalation (#202)

## Modules

- `src/lib/whatsapp/inbound-service.ts`: coordinates normalized events through store, agent, WhatsApp client, escalation helper, and CRM staging.
- `src/lib/whatsapp/client.ts`: sends text messages through Meta WhatsApp Cloud API and returns structured results.
- `src/lib/whatsapp/escalation.ts`: composes escalation priority, customer follow-up text, and human alert text.
- `src/lib/whatsapp/store.ts`: exposes granular persistence helpers for orchestration while keeping existing ingestion API compatible.

## Flow

1. `route.ts` parses JSON and delegates the raw payload to `processWhatsAppWebhookPayload`.
2. The service normalizes events and calls `store.persistInboundEvent` for each event.
3. Duplicate/existing inbound messages stop immediately to avoid duplicate sends.
4. New text messages load conversation context and invoke the side-effect-free agent.
5. Unsupported/non-text messages bypass the agent and produce a deterministic `needs_human` decision.
6. The service persists an intent.
7. `auto_answer` sends a customer WhatsApp, persists outbound message, updates statuses, and stages `whatsapp.auto_answered` CRM event.
8. `needs_human` creates escalation work, sends customer follow-up, attempts human alert if configured, persists outbound/escalation/statuses, and stages `whatsapp.escalated` CRM event.

## Idempotency

- The unique provider inbound id remains the initial DB guard.
- If the inbound row already exists, service skips agent/send/write side effects beyond the ingestion touch.
- Outbound records use deterministic ids: `out:{purpose}:{inboundMessageId}`.
- CRM events use deterministic event keys: `whatsapp:auto_answered:{inboundMessageId}` and `whatsapp:escalated:{inboundMessageId}`.

## Configuration

- Meta transport reads server-only `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and optional `WHATSAPP_GRAPH_VERSION`.
- Escalation alert reads server-only `WHATSAPP_HUMAN_ALERT_PHONE` unless injected.
- Missing credentials produce skipped send results and do not crash local/test flows.

## Testing

Tests inject store, agent, and sender fakes to verify orchestration side effects without network/database calls. Transport tests inject `fetch` to assert the Meta request shape.
