# Apply Progress: CRM WhatsApp Client Lookup

## Completed Tasks
- [x] 1.1 Migration contract tests for `clients.whatsapp`, backfill/default trigger, and normalized index.
- [x] 1.2 Unit tests for CRM WhatsApp priority, duplicate ambiguity, and manual-link fallback.
- [x] 2.1 Supabase migration for nullable `clients.whatsapp`, `whatsapp_normalized`, backfill, trigger, and partial index.
- [x] 2.2 `whatsapp` added to `Client`, create/update inputs, row mapping, and representative mock clients.
- [x] 3.1 `getClientByWhatsappPhone` now queries normalized `clients.whatsapp` before fallbacks.
- [x] 3.2 Manual `whatsapp_contacts.linked_client_id` and legacy `clients.phone` fallback remain after CRM lookup.
- [x] 4.1 Operator docs updated without full real phone disclosure.
- [x] 4.2 Focused tests, full tests, typecheck, lint, build, and dry-run harness executed.

## Work Unit Evidence
| Evidence | Result |
|---|---|
| Focused test command | `npx vitest run src/lib/ai/__tests__/travelhub-client-tools.test.ts src/__tests__/whatsapp-client-lookup-migration.test.ts` → exit 0, 13 tests passed. |
| Runtime harness | First run without configured sender failed safely; rerun with fake masked sender `521…0000`: `npm run whatsapp:simulate -- --dry-run --from <fake> --text "¿cómo va mi viaje?"` → exit 0, payload generated only. |
| Rollback boundary | Revert migration `20260828015023_clients_whatsapp_lookup.sql`, tool/data/type/test/doc changes. |

## TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1/2.1 | `src/__tests__/whatsapp-client-lookup-migration.test.ts` | Unit contract | N/A (new) | ✅ Failed before migration existed | ✅ 3/3 passed | ✅ field, trigger, index cases | ✅ normalized column design |
| 1.2/3.1/3.2 | `src/lib/ai/__tests__/travelhub-client-tools.test.ts` | Unit | ✅ 8/8 existing passed | ✅ CRM priority/ambiguity failed against old lookup | ✅ 10/10 tool tests passed | ✅ success, duplicate ambiguous, manual fallback | ✅ shared match-result helper |
| 2.2 | Type/data mapping | Typecheck | ✅ existing suite protected | ✅ covered by TypeScript contract | ✅ `npx tsc --noEmit` passed | ➖ structural mapping | ➖ none needed |
| 4.1/4.2 | Docs/verification | Runtime | N/A | ✅ harness missing-sender failure observed | ✅ dry-run with fake sender passed | ➖ one runtime path | ➖ none needed |

## Deviations
- Added internal `clients.whatsapp_normalized` column so PostgREST can filter reliably and use a normal partial btree index.

## Issues
- Local Node is 20.19.6; Supabase packages warn Node >=22 is required. Verification still passed.
