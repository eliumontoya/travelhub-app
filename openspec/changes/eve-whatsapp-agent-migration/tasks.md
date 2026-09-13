# Tasks: WhatsApp Agent Migration to Vercel Eve

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1200–1500 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test | Runtime | Rollback |
|------|------|-----------|--------------|---------|----------|
| 1 | Dependencies + service-role client | PR 1 | `npm run build` | N/A | `package.json`, `src/lib/supabase/server.ts` |
| 2 | Agent config + instructions | — | `npx tsc --noEmit` | N/A | `agent/agent.ts`, `agent/instructions.md` |
| 3 | WhatsApp channel | — | `npx tsc --noEmit` | N/A | `agent/channels/whatsapp.ts`, `agent/trusted-contact-context.ts` |
| 4 | Tools (6) | — | `npm test` | N/A | `agent/tools/*.ts` |
| 5 | Skills (3) | — | `npx tsc --noEmit` | N/A | `agent/skills/*.md` |
| 6 | Final verify | — | `npm run build` + `npm test` + `npm run lint` | All new files | All new files |

## Phase 1: Dependencies & Service-Role Client (WU1)

- [x] 1.1 Add `eve`, `ai`, `@ai-sdk/openai-compatible`, `@chat-adapter/whatsapp`, `@chat-adapter/state-memory` to `package.json`.
- [x] 1.2 Add `getSupabaseAdmin()` to `src/lib/supabase/server.ts`.
- [x] 1.3 Verify: `npm install`, `npx tsc --noEmit`, `npm run build`.

## Phase 2: Agent Config & Instructions (WU2)

- [x] 2.1 Create `agent/agent.ts` with OpenAI-compatible provider config.
- [x] 2.2 Create `agent/instructions.md` with Luna's system prompt.
- [x] 2.3 Verify: `npx tsc --noEmit`.

## Phase 3: WhatsApp Channel (WU3)

- [x] 3.1 Create `agent/channels/whatsapp.ts` with WhatsApp adapter and channel.
- [x] 3.2 Create `agent/trusted-contact-context.ts` with phone verification logic.
- [x] 3.3 Verify: `npx tsc --noEmit`.

## Phase 4: Tools (WU4)

- [x] 4.1 Create `agent/tools/lookup-client.ts`.
- [x] 4.2 Create `agent/tools/get-active-trips.ts`.
- [x] 4.3 Create `agent/tools/get-trip-summary.ts`.
- [x] 4.4 Create `agent/tools/get-trip-itinerary.ts`.
- [x] 4.5 Create `agent/tools/get-trip-documents.ts`.
- [x] 4.6 Create `agent/tools/escalate-to-human.ts`.
- [x] 4.7 Create `agent/tools/search-knowledge.ts` (updated for travel context).
- [x] 4.8 Verify: `npm test`, `npx tsc --noEmit`.

## Phase 5: Skills (WU5)

- [x] 5.1 Create `agent/skills/trip-inquiry.md`.
- [x] 5.2 Create `agent/skills/escalation.md`.
- [x] 5.3 Create `agent/skills/knowledge-answers.md`.
- [x] 5.4 Verify: `npx tsc --noEmit`.

## Phase 6: Final Verification (WU6)

- [x] 6.1 Verify: `npx tsc --noEmit`, `npm run build`, `npm test`, `npm run lint`.
- [x] 6.2 All 280 tests pass.
- [x] 6.3 Lint is clean.
