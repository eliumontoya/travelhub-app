# Proposal: WhatsApp webhook ingestion (issue #200)

## Problem

TravelHub has the private WhatsApp inbound data model from issue #199, but Meta WhatsApp Cloud API cannot yet verify or deliver inbound messages to the app. Without a webhook route, normalized contract, and idempotent store, later agent decisioning cannot run safely.

## Approach

Add a thin App Router route handler at `/api/whatsapp/webhook`:

- `GET` implements Meta webhook verification using `hub.mode`, `hub.verify_token`, and `hub.challenge` against server-only `WHATSAPP_VERIFY_TOKEN`.
- `POST` parses JSON, delegates pure payload normalization to `src/lib/whatsapp/normalize.ts`, then delegates persistence to `src/lib/whatsapp/store.ts`.
- `normalize.ts` extracts inbound message events into a stable internal contract and preserves raw event data.
- `store.ts` uses a server-side Supabase service-role client and #199 tables to upsert contacts/conversations and insert inbound messages idempotently by WhatsApp message id.

## Out of scope

- LLM intent extraction or decisioning.
- Auto-reply generation.
- WhatsApp outbound API client.
- Human escalation execution.
- Dashboard UI.
- Broad CRM sync staging behavior.
- Meta `X-Hub-Signature-256` validation; this can be added in a dedicated security/reliability phase after checking current official Meta docs.

## Rollback plan

Revert the route, normalizer/store helpers, tests, and spec delta. No new migration is required for this issue; data written by a deployed webhook can be left in private #199 tables or cleaned by deleting rows keyed by test/provider message ids if needed.
