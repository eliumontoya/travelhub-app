# Design: WCC Polish, Empty States, and Integration QA

## Architecture
Keep WCC as authenticated App Router routes under `src/app/dashboard/wcc`. Pages remain Server Components for Supabase reads. Add two route-local presentation files:

- `components.tsx` for non-data UI primitives: `WccNotice`, `WccEmptyState`, `WccBackLink`, `WccInlineLink`.
- `nav-link.tsx` as the only new Client Component, using `usePathname` for active nav state.

## Data Flow
No data schema or helper behavior changes are required. Existing helpers continue returning safe `isSupabaseConfigured` and `isConfiguredButUnavailable` flags. UI consumes those flags to render consistent notices.

## Links
Only link to routes already implemented in prior WCC slices:

- Dashboard recent contacts -> `/dashboard/wcc/contacts/[id]`.
- Dashboard recent conversations -> `/dashboard/wcc/conversations/[id]`.
- Contact detail related conversations -> `/dashboard/wcc/conversations/[id]`.
- Conversation detail contact -> `/dashboard/wcc/contacts/[id]`.
- Conversation detail linked client -> `/dashboard/clients/[id]` when `linkedClientId` exists.
- Escalation context -> existing contact and conversation routes.

No escalation detail page is added.

## Responsive Strategy
Hide desktop list header rows below `sm` and let existing single-column row grids carry mobile labels/content. Make pagination controls wrap vertically on narrow screens.

## Testing
- TypeScript proves component prop compatibility.
- Existing unit tests prove WCC data helpers still return safe states.
- New Playwright smoke tests cover WCC nav links, final PR copy, safe empty states, and mobile route rendering.

## Rollback
Remove the two new WCC component files, revert page markup, remove WCC docs/test, and keep prior WCC data helpers untouched.
