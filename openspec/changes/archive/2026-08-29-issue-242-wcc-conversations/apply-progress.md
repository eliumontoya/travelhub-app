# Apply Progress: WCC Grouped Conversations View

## Completed
- Added `src/lib/wcc-conversations.ts` with read-only list/detail helpers, safe fallbacks, and batched contact/message/intent enrichment.
- Added `/dashboard/wcc/conversations` grouped list route and loading state.
- Added `/dashboard/wcc/conversations/[id]` read-only timeline/detail route.
- Updated WCC navigation to link to conversations without adding a raw messages menu.
- Added focused Vitest coverage for fallback, mapping, and detail timeline behavior.
