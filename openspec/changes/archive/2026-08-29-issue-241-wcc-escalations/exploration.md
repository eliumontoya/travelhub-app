## Exploration: WCC escalations queue

### Current State
`/dashboard/wcc` exposes the WCC shell and dashboard KPIs. PR #240 added `/dashboard/wcc/contacts` plus contact detail context, including related escalations. The WhatsApp data foundation already has `whatsapp_escalations` with indexes on `status`, `opened_at`, `contact_id`, and `conversation_id`, RLS for authenticated admin access, and domain types in `src/types/index.ts`.

### Affected Areas
- `src/lib/wcc-escalations.ts` — new read-only data helper for queue rows and batched related context.
- `src/app/dashboard/wcc/escalations/page.tsx` — new recent-first queue UI with filters.
- `src/app/dashboard/wcc/escalations/loading.tsx` — loading fallback for the route.
- `src/app/dashboard/wcc/layout.tsx` — route WCC nav to the real escalations queue.
- `src/lib/__tests__/wcc-escalations.test.ts` — focused mapping/fallback/filter tests.
- `openspec/specs/wcc-command-center/spec.md` — source specification after archive.

### Approaches
1. **Dedicated helper with batch enrichment** — Query escalations once, then load contacts and conversations by ID arrays.
   - Pros: avoids N+1 queries, follows contacts helper pattern, keeps UI server-rendered.
   - Cons: small amount of mapping code.
   - Effort: Medium
2. **Inline page queries** — Put Supabase reads directly in the page.
   - Pros: fewer files.
   - Cons: duplicates error handling and makes testing harder.
   - Effort: Low

### Recommendation
Use a dedicated server helper with batched enrichment and safe empty/unavailable fallbacks. Keep v1 read-only and expose only status/priority filters from `searchParams`.

### Risks
- Deep OFFSET pagination can degrade later; v1 uses the existing page pattern and indexed recent-first ordering.
- Missing WhatsApp tables in local/prod must not break dashboard navigation.

### Ready for Proposal
Yes — implement a read-only escalations queue only.
