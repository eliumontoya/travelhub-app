# Tasks: WhatsApp response orchestration and escalation (#202)

## Explore / design

- [x] Read required repo docs and architecture document.
- [x] Read issue #202 and current OpenSpec specs.
- [x] Read local Next.js Route Handler docs before route changes.
- [x] Read Supabase/Supabase Postgres best-practice guidance before data-layer changes.
- [x] Create issue #202 OpenSpec proposal/spec/design/tasks.

## TDD / implementation

- [x] Add RED tests for inbound-service auto-answer orchestration.
- [x] Add RED tests for needs_human escalation orchestration.
- [x] Add RED tests for unsupported message escalation.
- [x] Add RED tests for duplicate inbound send suppression.
- [x] Add RED tests for WhatsApp Cloud API client request construction and missing-credential skip.
- [x] Implement client, escalation helper, inbound service, store extensions, and webhook delegation.

## Verification / archive / PR

- [x] Run focused tests.
- [x] Run `npx tsc --noEmit`.
- [x] Run `npm run test`.
- [x] Run `npm run build` if feasible.
- [x] Merge delta into `openspec/specs/whatsapp-inbound-automation/spec.md` and `openspec/specs/crm-sync-staging/spec.md`.
- [x] Archive change folder.
- [ ] Commit, push, and open PR linked to #202/#198.
