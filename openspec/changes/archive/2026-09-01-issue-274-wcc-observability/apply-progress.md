# Apply Progress: WCC WhatsApp and AI Observability

**Change**: issue-274-wcc-observability
**Mode**: Strict TDD
**Delivery strategy**: exception-ok / single PR for full epic closure
**Schema change**: None. No migrations, RLS policies, DB functions, or storage buckets changed.

## Completed Tasks

- [x] Added `src/lib/observability/whatsapp-ai.ts` with typed correlation context, event IDs, sanitizer, bounded in-memory metrics, safe logging, and test reset helpers.
- [x] Added observability contract tests for correlation, metrics, recent failures, redaction, and sink failure isolation.
- [x] Instrumented `POST /api/whatsapp/webhook` for admission/rejection/parse/processing events without raw body logging.
- [x] Propagated observability context through inbound/status processing.
- [x] Instrumented persistence, duplicates, AI decisions, provider lifecycle, dynamic TravelHub tools, sends, status callbacks, and escalations.
- [x] Exposed WCC summary observability metrics and rendered read-only sanitized metrics/failures on `/dashboard/wcc`.
- [x] Updated `architecture.md` so future WhatsApp/AI features must use the observability layer.

## Verification Evidence

- `npm run test -- src/lib/observability/__tests__/whatsapp-ai.test.ts src/lib/whatsapp/__tests__/inbound-service.test.ts src/app/api/whatsapp/webhook/__tests__/route.test.ts src/lib/__tests__/wcc-dashboard.test.ts src/lib/ai/__tests__/whatsapp-inbound-agent.test.ts` — PASS, 5 files / 57 tests.
- `npm run test` — PASS, 50 files / 280 tests.
- `npx tsc --noEmit` — PASS.
- `npm run lint` — PASS.
- `npm run build` — PASS.

## Warnings

- Local build warns that Next.js `middleware` convention is deprecated in favor of `proxy`; unchanged and out of scope.
- Local build warns Node.js 20 is below Supabase's future Node.js 22 support direction; unchanged and out of scope.
