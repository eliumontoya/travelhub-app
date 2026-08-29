# Proposal: WCC Contacts List and Detail

## Intent
Add the first operational WCC drill-down so the agent can identify WhatsApp senders and inspect contact context.

## Scope
In scope: `/dashboard/wcc/contacts`, `/dashboard/wcc/contacts/[id]`, read-only contact rows, linked TravelHub client display, pagination, and limited related conversations/escalations/intents in the detail. Out of scope: manual client linking, contact mutations, escalations queue, conversations main view, and knowledge CRUD.

## Capabilities
Modified: `wcc-command-center` adds read-only contacts list/detail. New: none.

## Approach
Use Server Components and `src/lib/wcc-contacts.ts` for safe read-only Supabase queries. Return empty results in mock mode and unavailable detail/list states if configured reads fail.

## Affected Areas
| Area | Impact |
|------|--------|
| `src/app/dashboard/wcc/layout.tsx` | Real contacts nav link |
| `src/app/dashboard/wcc/contacts/*` | List/detail/loading UI |
| `src/lib/wcc-contacts.ts` | Read-only data helper |
| `src/lib/__tests__/wcc-contacts.test.ts` | Focused helper tests |
| `openspec/specs/wcc-command-center/spec.md` | Adds contacts requirements |

## Risks / Rollback
Risk is medium-low because the change is read-only and uses existing indexed columns. Roll back by removing the contacts routes/helper/tests and reverting the spec/nav updates.

## Success Criteria
- [ ] Agent can open `/dashboard/wcc/contacts` from WCC nav.
- [ ] Contact list is paginated and ordered by recent activity.
- [ ] Contact detail centralizes linked client, conversations, escalations, and intents.
- [ ] No contact mutations or unrelated WCC sections are implemented.
