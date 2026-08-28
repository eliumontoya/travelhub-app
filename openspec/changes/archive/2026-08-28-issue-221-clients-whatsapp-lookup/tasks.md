# Tasks: CRM WhatsApp Client Lookup

## Review Workload Forecast
| Field | Value |
|-------|-------|
| Estimated changed lines | 220-320 |
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
| 1 | DB + tool lookup + docs | PR 1 | `npm run test -- src/lib/ai/__tests__/travelhub-client-tools.test.ts src/__tests__/whatsapp-client-lookup-migration.test.ts` | `npm run whatsapp:simulate -- --dry-run --text "¿cómo va mi viaje?"` | Migration plus tool/data/docs files. |

## Phase 1: RED Tests
- [x] 1.1 Add failing migration contract tests for `clients.whatsapp`, backfill/default trigger, and normalized index.
- [x] 1.2 Add failing unit tests for CRM WhatsApp priority, duplicate ambiguity, and manual-link fallback.

## Phase 2: Database / Types
- [x] 2.1 Create Supabase migration for nullable `clients.whatsapp`, initial backfill, copy trigger, and normalized partial index.
- [x] 2.2 Add `whatsapp` to `Client`, create/update inputs, row mapping, and mock client data.

## Phase 3: Tool Implementation
- [x] 3.1 Update `getClientByWhatsappPhone` to query normalized `clients.whatsapp` before fallbacks and preserve safe ambiguity behavior.
- [x] 3.2 Keep `whatsapp_contacts.linked_client_id` and legacy `clients.phone` compatibility paths after CRM lookup.

## Phase 4: Docs / Verification
- [x] 4.1 Document CRM WhatsApp setup in `doc/whatsapp-simulated-inbound-tests.md` without full phone disclosure.
- [x] 4.2 Run focused tests, typecheck, lint, build, and record verification evidence.
