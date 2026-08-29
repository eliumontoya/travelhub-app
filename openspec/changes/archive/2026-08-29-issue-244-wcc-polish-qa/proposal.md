# Proposal: WCC Polish, Empty States, and Integration QA

## Intent
Close the WCC v1 chain with a cohesive, navigable MVP that degrades safely and feels complete across dashboard, contacts, escalations, conversations, and knowledge.

## Scope

### In Scope
- Improve WCC navigation active state and section links.
- Add consistent WCC notices and action-oriented empty/not-found states.
- Add cross-links between dashboard cards, contacts, conversations, escalations, and TravelHub clients where IDs already exist.
- Improve mobile responsiveness for WCC list headers/pagination without changing data models.
- Add concise WCC feature documentation and E2E smoke coverage.

### Out of Scope
- New WhatsApp tables, migrations, or RLS changes.
- New mutation controls outside knowledge entries.
- Inbox/reply features, assignment workflows, or bot/webhook behavior changes.
- Large design-system refactor.

## Capabilities

### Modified Capabilities
- `wcc-command-center`: final MVP polish for navigation, empty states, cross-links, responsive QA, and docs.

## Approach
Use small route-local presentation helpers plus a `WccNavLink` client component for active nav. Keep all data-loading pages as Server Components. Reuse existing IDs to add links only where destination routes already exist. Document WCC v1 scope and QA commands.

## Affected Areas
| Area | Impact | Description |
|---|---|---|
| `src/app/dashboard/wcc/components.tsx` | New | Shared WCC empty/notice/link helpers. |
| `src/app/dashboard/wcc/nav-link.tsx` | New | Active WCC nav state using `usePathname`. |
| `src/app/dashboard/wcc/**/page.tsx` | Modified | Empty states, cross-links, mobile polish. |
| `doc/features/whatsapp-command-control.md` | New | WCC v1 operating notes. |
| `doc/features/README.md` | Modified | Link WCC feature docs. |
| `e2e/wcc-polish.spec.ts` | New | WCC navigation/responsive smoke tests. |

## Risks
| Risk | Likelihood | Mitigation |
|---|---:|---|
| Overbuilding into features | Low | Limit to UI polish, docs, and test coverage only. |
| Auth-dependent E2E flakes | Med | Skip when login page is shown. |
| Client/server import mistake | Low | Keep active nav client-only and WCC helpers free of server dependencies. |

## Rollback Plan
Revert this PR to remove the route-local polish helpers/tests/docs and restore previous WCC page markup.

## Dependencies
- #243 / PR #249 branch `feat/wcc-243-knowledge` at commit `b5f43d4`.

## Success Criteria
- [ ] WCC nav links all sections and highlights current route.
- [ ] Empty/unavailable states are clear and action-oriented.
- [ ] Cross-links prevent dead-end operational pages.
- [ ] WCC pages remain usable on narrow/mobile viewport.
- [ ] Typecheck, lint, unit, build, and E2E checks pass.
