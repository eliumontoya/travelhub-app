# Apply Progress: WhatsApp inbound agent decisioning (#201)

## Branch strategy

- Stacked on `origin/feat/issue-200-whatsapp-webhook-ingestion` because PR #205 is open/unmerged.
- Final PR should target `feat/issue-200-whatsapp-webhook-ingestion` until #205 merges.

## TDD

1. Added focused RED tests in `src/lib/ai/__tests__/whatsapp-inbound-agent.test.ts`.
2. Confirmed RED failure: module `@/lib/ai/whatsapp-inbound-agent` did not exist.
3. Implemented `src/lib/ai/whatsapp-inbound-agent.ts`.
4. Focused tests passed: 1 file / 8 tests.

## Implementation

- Added approved knowledge retrieval from `whatsapp_knowledge_entries` with `status = approved`, deterministic ordering, and bounded limit.
- Added `decideWhatsAppInboundMessage` with provider DI, conservative preflight gates, zod output validation, and safe fallback behavior.
- Added no route changes, DB writes, outbound sends, CRM sync, or UI.
