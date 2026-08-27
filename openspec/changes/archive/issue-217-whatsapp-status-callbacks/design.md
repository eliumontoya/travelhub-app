# Design — WhatsApp status callbacks

## Data model
Add `whatsapp_message_status_callbacks` as a private audit table:

- `whatsapp_message_id`: Meta provider id from the callback.
- `message_id`: nullable FK to `whatsapp_messages.id` when the outbound ledger row exists.
- `status`: one of `sent`, `delivered`, `read`, `failed`.
- `recipient_phone`: `recipient_id` from Meta.
- `occurred_at`: callback timestamp normalized to ISO/timestamptz.
- `payload`: raw status callback plus normalized fields and error details.
- `callback_key`: unique idempotency key `whatsapp:status:<provider id>:<status>:<timestamp>`.

Expand `whatsapp_messages.status` to include `delivered` and `read`. `failed` already exists and remains usable for send failures and later delivery failures.

## Normalization
`normalize.ts` keeps inbound messages and status callbacks separate:

- `normalizeWhatsAppWebhookPayload(payload)` continues returning only inbound message events.
- `normalizeWhatsAppWebhookStatusPayload(payload)` returns status events from `value.statuses` and never treats them as inbound messages.
- `normalizeWhatsAppWebhookPayloadBundle(payload)` returns both arrays so route orchestration can process mixed payloads safely.

## Persistence and idempotency
`store.ts` adds `persistWhatsAppStatusEvents(events)`:

1. Look up `whatsapp_messages` by `whatsapp_message_id = providerMessageId`.
2. Insert/upsert the callback audit row with `callback_key` and `ignoreDuplicates`.
3. Update the outbound message status/payload when found, preserving existing payload and appending/updating a `deliveryStatus` object.
4. Stage a CRM sync event using the same callback key.

The update does not create contacts, conversations, or inbound message rows, satisfying callback isolation.

## Outbound association improvement
`insertWhatsAppOutboundMessage` will store `sendResult.providerMessageId` as `whatsapp_message_id` when Meta returns it. The existing synthetic id remains the fallback for skipped or failed sends without a provider id. This lets later status callbacks match outbound rows directly.

## Route behavior
`POST /api/whatsapp/webhook` processes inbound and status callback events from the same payload and returns HTTP 200 for valid status-only payloads. Missing Supabase configuration still returns 503 without secrets.
