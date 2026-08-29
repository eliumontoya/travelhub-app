## Exploration: WCC knowledge entries management

### Current State
WCC has a shell/dashboard, read-only contacts, escalations, and grouped conversations. `whatsapp_knowledge_entries` already exists with `topic`, `question`, `answer`, `tags`, `source`, `status`, `approved_at`, and timestamps. The inbound agent reads only rows where `status = approved`; there is no dashboard route to curate entries.

### Affected Areas
- `src/lib/wcc-knowledge.ts` — new data helper for paginated reads, detail reads, validation, create/edit, and status changes.
- `src/app/dashboard/wcc/knowledge` — new list/create route and loading state.
- `src/app/dashboard/wcc/knowledge/[id]` — edit route.
- `src/app/dashboard/wcc/knowledge/actions.ts` — Server Actions for mutations.
- `src/app/dashboard/wcc/knowledge/*.tsx` — client form/status components for validation feedback.
- `src/app/dashboard/wcc/layout.tsx` — route WCC nav to Knowledge.
- `src/lib/__tests__/wcc-knowledge.test.ts` — validation, query, and mutation coverage.
- `openspec/specs/wcc-command-center/spec.md` — source WCC spec updated after archive.

### Approaches
1. **Dedicated helper plus Server Actions** — Keep Supabase access and validation in `src/lib/wcc-knowledge.ts`, call it from route-local Server Actions, and render small client form components for action state feedback.
   - Pros: follows app conventions, centralizes server-side validation, testable, avoids direct page mutations.
   - Cons: adds several small files.
   - Effort: Medium
2. **Inline route actions only** — Put Supabase calls directly in actions/pages.
   - Pros: fewer abstractions initially.
   - Cons: harder to test validation and fallback behavior; duplicates WCC read helpers.
   - Effort: Low

### Recommendation
Use a dedicated WCC knowledge helper with bounded Supabase reads, allowlisted status filters, normalized tags, and server-side mutation validation. Use Server Actions for create/edit/status changes and keep all other WhatsApp tables read-only.

### Risks
- Invalid approved content could be used by the inbound agent; require topic/question/answer validation before approving.
- Missing Supabase configuration should not crash local WCC navigation; mutations should return safe errors.
- Status transitions must keep `approved_at` aligned with approved-only usage.

### Ready for Proposal
Yes — implement only WCC knowledge CRUD/status management for #243.
