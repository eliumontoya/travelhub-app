# Apply Progress: WhatsApp inbound data foundation (issue #199)

## Mode

Strict TDD per `openspec/config.yaml`.

## RED

Added `src/__tests__/whatsapp-data-foundation.test.ts` before implementation.

Initial focused run failed as expected:

```text
npm run test -- src/__tests__/whatsapp-data-foundation.test.ts
Test Files  1 failed (1)
Tests  3 failed (3)
```

Failures proved the missing migration and missing TypeScript contracts.

## Implementation completed

- [x] Created migration with Supabase CLI: `supabase migration new whatsapp_inbound_data_foundation`.
- [x] Added `supabase/migrations/20260826194451_whatsapp_inbound_data_foundation.sql`.
- [x] Created tables:
  - `whatsapp_contacts`
  - `whatsapp_conversations`
  - `whatsapp_messages`
  - `whatsapp_intents`
  - `whatsapp_escalations`
  - `whatsapp_knowledge_entries`
  - `crm_sync_events`
- [x] Added constraints for lifecycle/status fields and confidence/attempt validation.
- [x] Added indexes for phone identity, FK joins, provider message id idempotency, statuses, timestamps, approved knowledge tags, and pending CRM polling.
- [x] Enabled and forced RLS on all new tables.
- [x] Revoked all access from `anon`; granted explicit CRUD to `authenticated`; added mono-admin policies.
- [x] Added TypeScript unions/interfaces in `src/types/index.ts`.
- [x] Added source-of-truth specs:
  - `openspec/specs/whatsapp-inbound-automation/spec.md`
  - `openspec/specs/crm-sync-staging/spec.md`

## Deliberate non-implementation

No webhook route, WhatsApp sender client, LLM decisioning, orchestration service, CRM processor, or dashboard UI was added. Those belong to later issues under epic #198.
