# Proposal: WCC Shell and Dashboard

## Intent
Create the first authenticated WhatsApp Command Control surface: entry nav, local WCC shell, and read-only operational dashboard.

## Scope
In scope: `WhatsApp C.C.` nav link, `/dashboard/wcc` layout, safe KPIs, empty states, and future-section placeholders. Out of scope: contacts/escalations/conversations/knowledge CRUD and inbound bot behavior changes.

## Capabilities
New: `wcc-command-center` for the authenticated WCC shell and dashboard. Modified: none.

## Approach
Use Server Components under `src/app/dashboard/wcc` and isolate Supabase reads in `src/lib/wcc-dashboard.ts`. Return zeros when Supabase is absent; catch read failures to avoid breaking local or partially migrated environments.

## Affected Areas
| Area | Impact |
|------|--------|
| `src/app/dashboard/layout.tsx` | Adds WCC entry link |
| `src/app/dashboard/wcc/*` | Adds shell/dashboard/loading |
| `src/lib/wcc-dashboard.ts` | Adds read-only summary helper |
| `src/lib/__tests__/wcc-dashboard.test.ts` | Adds focused tests |

## Risks / Rollback
Risk is low because no mutations or migrations are added. Rollback by removing the WCC files, test/helper, spec, and nav link.

## Success Criteria
- [ ] Agent can enter `/dashboard/wcc` from dashboard nav.
- [ ] WCC has local navigation and a `TravelHub` return link.
- [ ] Dashboard renders safely without WhatsApp data.
- [ ] No inbound bot behavior changes.
