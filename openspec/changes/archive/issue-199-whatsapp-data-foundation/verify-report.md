# Verification Report: WhatsApp inbound data foundation (issue #199)

## Summary

Verification passed for code/tests/build. Supabase local schema lint was attempted but the local Postgres container was not running, so it could not connect.

## Commands

| Command | Result | Notes |
|---|---|---|
| `npm run test -- src/__tests__/whatsapp-data-foundation.test.ts` before implementation | Failed as expected | RED: missing migration and TS contracts. |
| `npm run test -- src/__tests__/whatsapp-data-foundation.test.ts` after implementation | Passed | 1 file / 3 tests. |
| `npm run lint` | Passed with existing warning | Warning in `src/components/MoveItemToDayDialog.tsx` for unused `useState`; unrelated to this branch's files. Exit code 0. |
| `npx tsc --noEmit` | Passed | No TypeScript errors. |
| `npm run test` | Passed | 11 files / 86 tests. |
| `npm run build` | Passed | Next.js build succeeded; emitted existing middleware deprecation and Node 20 Supabase warnings. |
| `supabase db lint --local` | Not run to completion | Failed to connect to local Postgres on `127.0.0.1:54322`; Docker/local Supabase was not running. |

## Acceptance coverage

| Acceptance criterion | Evidence |
|---|---|
| Tables for contacts, conversations, messages, intents, escalations, knowledge, CRM events | Migration creates all seven tables; focused test asserts names. |
| RLS enabled and no anon exposure | Migration enables/forces RLS, revokes `anon`, grants only `authenticated`; focused test asserts RLS/revoke/grant strings for all tables. |
| Indexes for phone, conversation, message id, statuses, timestamps | Migration includes unique phone/message ids plus FK/status/timestamp indexes and pending CRM partial index. |
| TypeScript contracts | `src/types/index.ts` exports status unions and interfaces; focused test asserts contract names. |
| CRM events pending/processed/failed | `crm_sync_events.status` check includes `pending`, `processing`, `processed`, `failed`; test asserts lifecycle check. |
| No webhook/LLM/orchestration/UI | Diff only adds migration, types, tests, and OpenSpec docs. |

## Environment notes

- `npm ci` and `npm run build` emitted Supabase package warnings because local Node is `v20.19.6` while current Supabase packages prefer/require Node 22. Commands still completed.
- Build emitted the existing Next.js 16 middleware-to-proxy deprecation warning.
