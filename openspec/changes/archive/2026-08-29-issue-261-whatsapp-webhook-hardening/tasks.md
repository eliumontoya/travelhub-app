# Tasks: WhatsApp Webhook Hardening

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 180-260 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Signed webhook admission helper + route behavior | PR 1 | `npm run test -- src/app/api/whatsapp/webhook/__tests__/route.test.ts` | `npm run whatsapp:simulate -- --dry-run` after docs update; no external POST required | `src/lib/whatsapp/signature.ts`, route POST changes, webhook route tests |
| 2 | Operator docs for required secret | PR 1 | `npm run test -- src/app/api/whatsapp/webhook/__tests__/route.test.ts` | N/A: documentation-only behavior | `doc/whatsapp-real-test-setup.md`, `doc/whatsapp-simulated-inbound-tests.md` |

## Phase 1: RED Tests (sequential before production)

- [x] 1.1 [Req: Signed Meta webhook POST admission] Add route test helpers in `src/app/api/whatsapp/webhook/__tests__/route.test.ts` to sign exact raw `JSON.stringify` bodies with deterministic `WHATSAPP_APP_SECRET`.
- [x] 1.2 [Req: Signed Meta webhook POST admission] RED: assert valid signed inbound and status POSTs delegate unchanged to `processWhatsAppWebhookPayload`.
- [x] 1.3 [Req: Signed Meta webhook POST admission] RED: assert missing, malformed, mismatched, wrong-prefix, non-hex, length-mismatch, and byte-different signatures return 401 and never call the processor.
- [x] 1.4 [Reqs: Signed Meta webhook POST admission; App Secret production configuration] RED: assert validly signed invalid JSON returns 400, and missing/blank `WHATSAPP_APP_SECRET` returns 503 without secret disclosure or processor calls.

## Phase 2: GREEN Implementation (sequential after Phase 1)

- [x] 2.1 [Req: Signed Meta webhook POST admission] Create `src/lib/whatsapp/signature.ts` with `verifyWhatsAppWebhookSignature`, `crypto.createHmac`, strict `sha256=<hex>` parsing, and `timingSafeEqual` length guards.
- [x] 2.2 [Req: Signed Meta webhook POST admission] Modify `src/app/api/whatsapp/webhook/route.ts` POST to read `request.text()`, verify before `JSON.parse`, map failures to 503/401/400, then delegate parsed payload.
- [x] 2.3 [Req: Signed Meta webhook POST admission] Preserve existing GET challenge behavior and existing processing/store error handling while making all current POST tests signed.

## Phase 3: REFACTOR, Docs, Verify (docs parallel after Phase 2)

- [x] 3.1 [Req: WhatsApp App Secret production configuration] Update `doc/whatsapp-real-test-setup.md` to list `WHATSAPP_APP_SECRET` as required server-side production config before accepting POST deliveries.
- [x] 3.2 [Req: WhatsApp App Secret production configuration] Update `doc/whatsapp-simulated-inbound-tests.md` with signed webhook simulation implications and required secret note.
- [x] 3.3 [Reqs: all] Run `npm run test -- src/app/api/whatsapp/webhook/__tests__/route.test.ts`, then `npx tsc --noEmit`; if touched files broaden, run `npm run test`.
