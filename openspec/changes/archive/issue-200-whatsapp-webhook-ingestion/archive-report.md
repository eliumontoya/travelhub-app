# Archive Report: WhatsApp webhook ingestion (issue #200)

**Change**: `issue-200-whatsapp-webhook-ingestion`
**Epic**: #198
**Capability**: `whatsapp-inbound-automation`
**Archived**: 2026-08-26
**Status**: Verified and ready for PR

## Artifacts preserved

- `explore.md` — source review, missing architecture doc note, payload assumptions, mapping, risks.
- `proposal.md` — scope, approach, out of scope, rollback.
- `spec.md` — delta for webhook verification, normalization, persistence/idempotency, safe configuration failure.
- `design.md` — route/normalizer/store split and idempotency design.
- `tasks.md` — all tasks complete.
- `apply-progress.md` — RED/GREEN/REFACTOR notes.
- `verify-report.md` — command evidence.
- `archive-report.md` — this report.

## Source of truth updated

- `openspec/specs/whatsapp-inbound-automation/spec.md`

## Implementation summary

- Added `GET /api/whatsapp/webhook` for Meta verify-token challenge.
- Added `POST /api/whatsapp/webhook` for JSON parsing, normalization, and persistence delegation.
- Added pure normalizer at `src/lib/whatsapp/normalize.ts`.
- Added service-role Supabase store at `src/lib/whatsapp/store.ts` for contact upsert, open conversation lookup/create, idempotent inbound message insert, and conversation touch.
- Unsupported message types preserve raw payload and do not crash normalization or route handling.

## Verification summary

Passed:

- Focused Vitest suite: 3 files, 10 tests.
- `npx tsc --noEmit`.
- `npm run lint`.
- `npm run test`: 31 files, 146 tests.
- `npm run build`.

Warnings:

- Supabase packages warn about local Node v20.19.6; Node 22 should be used soon.
- Next warns existing `middleware` convention is deprecated.

## SDD cycle complete

The change has been explored, specified, designed, implemented with tests, verified, archived, and prepared for PR.
