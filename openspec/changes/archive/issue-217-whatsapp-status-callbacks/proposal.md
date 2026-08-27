# Issue #217 — Track WhatsApp outbound delivery status callbacks

## Summary
Process Meta WhatsApp Cloud API `statuses` webhook callbacks for outbound messages, persist an idempotent delivery-status audit ledger, and update the related outbound `whatsapp_messages` row with the latest known provider status.

## Motivation
`whatsapp_messages.status = sent` currently means only that Meta accepted the send request. TravelHub needs durable visibility into whether outbound WhatsApp messages were later sent, delivered, read, or failed so production debugging can answer “Meta accepted it, but did the customer receive it?” without creating duplicate inbound conversations/messages.

## Scope
- Normalize WhatsApp `value.statuses` payloads separately from inbound `messages` events.
- Persist status callbacks idempotently using provider message id + status + timestamp.
- Update outbound `whatsapp_messages.status` for `sent`, `delivered`, `read`, and `failed` without dropping the original send payload.
- Store delivery failure details from Meta in queryable JSON payloads.
- Stage a CRM/audit event for status changes with stable idempotency keys.
- Cover success and failed callback cases with unit tests and route tests.

## Out of scope
- Changing inbound LLM decision rules.
- Changing WhatsApp send content or transport credentials.
- Building a dashboard/inbox UI for status history.
- Merging the PR.

## Rollback plan
The change is additive except for expanding the `whatsapp_messages.status` check constraint and preferring the real provider id for new outbound rows when available. If a deployment issue appears, revert this PR and the migration. Existing rows keep their previous payloads; new status history rows can be ignored or dropped without impacting inbound ingestion.
