# Proposal: WCC Grouped Conversations View

## Intent
Let the agent review WhatsApp history by conversation thread instead of scanning raw individual messages.

## Scope

### In Scope
- Add `/dashboard/wcc/conversations` read-only grouped list.
- Show contact identity, status, last intent, latest inbound/outbound snippets, and last activity.
- Add `/dashboard/wcc/conversations/[id]` timeline with related messages and intents.
- Link conversation rows to contact/detail context.

### Out of Scope
- `/dashboard/wcc/messages` top-level route or menu.
- Manual reply actions, status mutations, or assignment changes.
- Knowledge CRUD (#243) and inbound bot/webhook behavior changes.

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `wcc-command-center`: add read-only grouped conversations and conversation timeline routes.

## Approach
Create `src/lib/wcc-conversations.ts` for safe Supabase reads, recent-first ordering by `last_message_at` with creation fallback, bounded pages, and batched contact/message/intent enrichment. Render server-component list/detail UIs with empty and unavailable states.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/wcc-conversations.ts` | New | Conversation list/detail data access and mapping. |
| `src/app/dashboard/wcc/conversations` | New | Grouped list, detail, loading route UI. |
| `src/app/dashboard/wcc/layout.tsx` | Modified | Conversations nav link. |
| `src/lib/__tests__/wcc-conversations.test.ts` | New | Data helper coverage. |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Raw message overload | Med | Only expose messages inside one conversation detail. |
| Query overfetch | Low | Select required columns and bounded ranges. |
| Missing tables | Med | Return safe empty/unavailable state. |

## Rollback Plan
Revert this PR to remove the conversations route/helper/tests and restore the WCC placeholder link.

## Dependencies
- #241 / PR #247 branch `feat/wcc-241-escalations`.
- Existing WhatsApp data foundation tables.

## Success Criteria
- [ ] Agent can open `/dashboard/wcc/conversations`.
- [ ] Conversations render grouped by thread with contact, status, intent, snippets, and activity.
- [ ] Detail timeline shows inbound/outbound messages plus relevant intents.
- [ ] No raw messages top-level menu or mutation controls are added.
