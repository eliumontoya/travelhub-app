# Tasks: WhatsApp inbound data foundation (issue #199)

## 1. Explore and specify
- [x] Read project, architecture, OpenSpec, Supabase, and relevant Next.js docs.
- [x] Document entity/field/relationship/status choices clearly for review.
- [x] Decide capability split between `whatsapp-inbound-automation` and `crm-sync-staging`.
- [x] Write proposal, spec delta, design, and tasks.

## 2. RED verification
- [x] Add focused tests that assert the migration and TypeScript contract surface exist.
- [x] Run focused tests and capture the expected failure before implementation.

## 3. Apply migration/types
- [x] Create Supabase migration with seven tables, constraints, RLS, grants, policies, and indexes.
- [x] Add TypeScript domain types to `src/types/index.ts`.

## 4. Sync OpenSpec source of truth
- [x] Add `openspec/specs/whatsapp-inbound-automation/spec.md`.
- [x] Add `openspec/specs/crm-sync-staging/spec.md`.

## 5. Verify
- [x] Run focused Vitest tests.
- [x] Run `npm run lint`.
- [x] Run `npx tsc --noEmit`.
- [x] Run `npm run test`.
- [x] Run `npm run build`.
- [x] Run or attempt Supabase schema lint/advisors and document result.

## 6. Archive and PR
- [x] Write apply progress, verify report, and archive report.
- [x] Move OpenSpec change to `openspec/changes/archive/issue-199-whatsapp-data-foundation/`.
- [ ] Commit, push branch, and open PR linked to #199 and referencing epic #198.
