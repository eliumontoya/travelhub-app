# Apply Progress: WhatsApp webhook ingestion (issue #200)

## Status

Implementation complete in strict TDD mode.

## TDD evidence

| Phase | Evidence |
|---|---|
| RED | `npx vitest run src/lib/whatsapp/__tests__/normalize.test.ts src/app/api/whatsapp/webhook/__tests__/route.test.ts` failed because `@/lib/whatsapp/normalize` and `src/app/api/whatsapp/webhook/route` did not exist. |
| GREEN | Added `normalize.ts`, `store.ts`, and `route.ts`; focused tests passed: 3 files, 9 tests. |
| REFACTOR | Added direct store coverage for service-role config, contact upsert, message insert, and duplicate acknowledgement. |

## Implemented tasks

- Pure normalizer for Meta WhatsApp webhook payloads, including unsupported message types.
- Thin App Router route handler for Meta GET verification and POST ingestion.
- Service-role Supabase store helper for private #199 tables.
- Atomic idempotency via `whatsapp_messages.whatsapp_message_id` unique constraint and Supabase `upsert(..., { onConflict, ignoreDuplicates: true })`.
- Focused unit/route tests for normalizer, GET verification, POST delegation/idempotency, and store behavior.

## Notes

- `WHATSAPP_APP_SECRET` signature validation is intentionally deferred to a later reliability/security phase.
- No new database migration is needed for issue #200; #199 tables already support this ingestion behavior.
