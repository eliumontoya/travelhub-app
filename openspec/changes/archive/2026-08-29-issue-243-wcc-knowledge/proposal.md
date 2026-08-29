# Proposal: WCC Knowledge Entries Management

## Intent
Let the agent maintain static WhatsApp knowledge from the dashboard so approved answers can power inbound automation without manual database edits.

## Scope

### In Scope
- Add `/dashboard/wcc/knowledge` with status filter, paginated list, and create form.
- Add `/dashboard/wcc/knowledge/[id]` edit form.
- Allow status changes among `draft`, `approved`, and `archived`.
- Validate topic, question, answer, tags, source, and status server-side.

### Out of Scope
- Mutations for contacts, conversations, messages, intents, or escalations.
- Changing inbound agent retrieval beyond preserving approved-only behavior.
- Delete operations or version history.

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `wcc-command-center`: add knowledge entries management as the only WCC v1 WhatsApp data mutation surface.

## Approach
Create a `wcc-knowledge` helper for safe Supabase reads and validated writes. Use route-local Server Actions with `revalidatePath`, client form components for action feedback, and server-rendered list/detail pages. Keep status filters allowlisted and set `approved_at` only when the saved status is `approved`.

## Affected Areas
| Area | Impact | Description |
|---|---|---|
| `src/lib/wcc-knowledge.ts` | New | Read/mutation helper and validation. |
| `src/app/dashboard/wcc/knowledge` | New | List/create/edit/status UI and actions. |
| `src/app/dashboard/wcc/layout.tsx` | Modified | Knowledge nav link. |
| `src/lib/__tests__/wcc-knowledge.test.ts` | New | Helper tests. |

## Risks
| Risk | Likelihood | Mitigation |
|---|---:|---|
| Bad approved answers | Med | Require non-empty bounded topic/question/answer before create/edit/approve. |
| Accidental WCC mutations elsewhere | Low | Only add actions under knowledge route. |
| Local unavailable DB | Med | Safe empty reads and mutation error states. |

## Rollback Plan
Revert this PR to remove knowledge route/helper/actions/tests and restore the dashboard placeholder link.

## Dependencies
- #242 / PR #248 branch `feat/wcc-242-conversations`.
- Existing `whatsapp_knowledge_entries` table and approved-only inbound retrieval.

## Success Criteria
- [ ] Agent can create knowledge from `/dashboard/wcc/knowledge`.
- [ ] Agent can edit existing entries.
- [ ] Agent can move entries among draft, approved, and archived.
- [ ] Server validation rejects invalid entries/statuses.
- [ ] Other WhatsApp WCC tables remain read-only.
