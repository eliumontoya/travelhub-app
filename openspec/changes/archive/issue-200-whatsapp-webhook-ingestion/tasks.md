# Tasks: WhatsApp webhook ingestion (issue #200)

## RED tests

- [x] Add normalizer tests for Meta text payload and unsupported message payload.
- [x] Add route handler tests for GET verification success/failure.
- [x] Add POST ingestion/idempotency tests with store/Supabase mocks.

## GREEN implementation

- [x] Implement `src/lib/whatsapp/normalize.ts` as a pure normalizer.
- [x] Implement initial `src/lib/whatsapp/store.ts` persistence/idempotency helpers.
- [x] Implement thin `src/app/api/whatsapp/webhook/route.ts` GET/POST handlers.

## Verify/archive/PR

- [x] Run focused tests during TDD.
- [x] Run `npx tsc --noEmit`.
- [x] Run `npm run test`.
- [x] Run `npm run build` if feasible.
- [x] Merge delta into `openspec/specs/whatsapp-inbound-automation/spec.md` and archive the change folder.
- [x] Commit, push branch, and open PR linked to #200 and epic #198.
