# Tasks

## Spec/design
- [x] Read issue #217, AGENTS.md, project.md, architecture.md, WhatsApp architecture docs, and local Next.js Route Handler docs.
- [x] Define status-callback behavior and rollback plan.

## Implementation
- [x] Add status callback normalization types/functions.
- [x] Add private Supabase migration for callback ledger and expanded message statuses.
- [x] Add status persistence service/store methods and CRM audit event staging.
- [x] Ensure webhook orchestration handles status-only payloads without inbound side effects.
- [x] Prefer real Meta provider id for new outbound rows when available.

## Verification
- [x] Add tests for sent/delivered/read/failed normalization and status-only route handling.
- [x] Add store tests for idempotent callback persistence and outbound status updates.
- [x] Run focused WhatsApp tests.
- [x] Run typecheck, lint, unit tests, build, and e2e.

## Delivery
- [ ] Archive OpenSpec change with reports.
- [ ] Commit and push branch.
- [ ] Open PR linked to issue #217 and label `type:feature`.
