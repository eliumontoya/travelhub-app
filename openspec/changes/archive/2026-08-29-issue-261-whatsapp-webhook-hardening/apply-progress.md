# Apply Progress: WhatsApp Webhook Hardening

## Status

All implementation tasks completed for `issue-261-whatsapp-webhook-hardening`.

## Completed Tasks

- [x] 1.1 Added deterministic exact-raw-body signing helpers to route tests.
- [x] 1.2 Added RED coverage for valid signed inbound and status POST delegation.
- [x] 1.3 Added RED coverage for missing, malformed, mismatched, wrong-prefix, non-hex, length-mismatch, and byte-different signatures.
- [x] 1.4 Added RED coverage for validly signed invalid JSON and missing/blank `WHATSAPP_APP_SECRET`.
- [x] 2.1 Created `src/lib/whatsapp/signature.ts` with HMAC-SHA256 and timing-safe verification.
- [x] 2.2 Updated `src/app/api/whatsapp/webhook/route.ts` to verify before JSON parsing/delegation.
- [x] 2.3 Preserved GET behavior, processing errors, duplicate acknowledgements, and status-only handling with signed POST tests.
- [x] 3.1 Documented `WHATSAPP_APP_SECRET` in `doc/whatsapp-real-test-setup.md`.
- [x] 3.2 Documented signed webhook simulation implications in `doc/whatsapp-simulated-inbound-tests.md`.
- [x] 3.3 Ran focused tests, typecheck, and the dry-run runtime harness.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `src/app/api/whatsapp/webhook/__tests__/route.test.ts` | Route unit | ✅ 6/6 baseline passed | ✅ Wrote exact raw-body signing helpers before route changes | ✅ Covered by focused run 21/21 | ✅ Helpers used by inbound/status/invalid cases | ✅ Kept helpers small and deterministic |
| 1.2 | `src/app/api/whatsapp/webhook/__tests__/route.test.ts` | Route unit | ✅ 6/6 baseline passed | ✅ Valid signed inbound/status expectations written before route changes | ✅ 21/21 focused tests passed | ✅ Inbound and status-only payloads both delegate unchanged | ✅ Existing success assertions preserved |
| 1.3 | `src/lib/whatsapp/__tests__/signature.test.ts`, route test | Unit + route unit | ✅ 6/6 baseline passed | ✅ Failure cases failed before route/helper implementation | ✅ 21/21 focused tests passed | ✅ Covered missing, malformed, wrong-prefix, non-hex, length mismatch, byte-different, and mismatched digest paths | ✅ Extracted pure verifier |
| 1.4 | Route test | Route unit | ✅ 6/6 baseline passed | ✅ Invalid JSON and missing-secret cases failed before route/helper implementation | ✅ 21/21 focused tests passed | ✅ Distinct 400 and 503 paths covered | ✅ No secret values included in responses |
| 2.1 | `src/lib/whatsapp/__tests__/signature.test.ts` | Unit | N/A (new file) | ✅ Import failed until helper was created | ✅ 21/21 focused tests passed | ✅ Exact raw body, tamper, config, malformed, and mismatch cases covered | ✅ Pure function with narrow result union |
| 2.2 | Route test | Route unit | ✅ 6/6 baseline passed | ✅ Route rejection tests failed before POST changed | ✅ 21/21 focused tests passed | ✅ Unauthorized, unavailable, invalid JSON, and happy paths covered | ✅ Error mapping centralized in route boundary |
| 2.3 | Route test | Route unit | ✅ 6/6 baseline passed | ✅ Existing POST tests converted to signed requests before implementation | ✅ 21/21 focused tests passed | ✅ Duplicate, store config error, inbound, and status-only paths covered | ✅ GET code unchanged |
| 3.1 | N/A | Documentation | N/A | N/A docs-only | ✅ Focused tests/typecheck still passed after docs | N/A docs-only | ✅ Added required secret note near existing env list |
| 3.2 | N/A | Documentation | N/A | N/A docs-only | ✅ Runtime dry-run passed | N/A docs-only | ✅ Documented dry-run and signed traffic implications |
| 3.3 | N/A | Verification | N/A | N/A verification task | ✅ Commands passed | N/A verification task | ✅ Evidence recorded |

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npm run test -- src/lib/whatsapp/__tests__/signature.test.ts src/app/api/whatsapp/webhook/__tests__/route.test.ts` → exit 0, 2 files passed, 21 tests passed |
| Typecheck command and exact result | `npx tsc --noEmit` → exit 0 |
| Runtime harness command/scenario and exact result | `npm run whatsapp:simulate -- --text "Prueba dry run" --from 5215551234567 --dry-run` → exit 0, printed simulated payload without external POST |
| Rollback boundary | Revert `src/lib/whatsapp/signature.ts`, route POST changes, webhook route/signature tests, docs updates, and this change folder |

## Deviations

None — implementation matches the design. Replay protection, IP allowlisting, rate limiting, and dashboards remain out of scope.
