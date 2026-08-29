# Proposal: WCC Escalations Queue

## Intent
Give the agent a fast operational queue for WhatsApp cases requiring human attention, prioritizing newest and urgent/open escalations.

## Scope

### In Scope
- Add `/dashboard/wcc/escalations` read-only route.
- Show recent-first `whatsapp_escalations` with contact, priority, status, reason/summary, opened/resolved dates.
- Add simple status and priority filters.
- Link each row to related contact context and show conversation id context.

### Out of Scope
- Mutating escalation status/assignment.
- Conversations main view (#242) or knowledge CRUD (#243).
- Webhook/bot/orchestration changes.

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `wcc-command-center`: add a read-only WCC escalations queue route and navigation.

## Approach
Create `src/lib/wcc-escalations.ts` for safe Supabase reads, allowlisted filters, recent-first ordering by `opened_at`, and batched contact/conversation enrichment. Render a server-component table/card UI with visible badges and empty/unavailable states.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/wcc-escalations.ts` | New | Queue data access and mapping. |
| `src/app/dashboard/wcc/escalations` | New | Route and loading UI. |
| `src/app/dashboard/wcc/layout.tsx` | Modified | Escalations nav link. |
| `src/lib/__tests__/wcc-escalations.test.ts` | New | Data helper coverage. |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Missing WhatsApp tables break route | Med | Catch read errors and render unavailable state. |
| Query overfetch | Low | Select only required columns and batch related rows. |

## Rollback Plan
Revert the PR to remove the route/helper/tests and restore WCC navigation.

## Dependencies
- #240 / PR #246 branch `feat/wcc-240-contacts`.
- Existing WhatsApp data foundation tables.

## Success Criteria
- [ ] Agent can open `/dashboard/wcc/escalations`.
- [ ] Escalations render newest first with priority/status distinction.
- [ ] Status/priority filters work without mutation controls.
- [ ] Rows link to related contact context when available.
