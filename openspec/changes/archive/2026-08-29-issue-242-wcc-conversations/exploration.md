## Exploration: WCC grouped conversations view

### Current State
`/dashboard/wcc` has the WCC shell/dashboard, `/contacts` with contact detail, and `/escalations` with recent-first queue. WhatsApp tables already include `whatsapp_conversations`, `whatsapp_messages`, and `whatsapp_intents` with indexes on conversation/contact/date columns and authenticated RLS. Conversation context appears only as snippets; there is no dedicated grouped conversation list or timeline.

### Affected Areas
- `src/lib/wcc-conversations.ts` — new read-only data helper for list rows, detail, timeline, and batched context.
- `src/app/dashboard/wcc/conversations/page.tsx` — grouped conversation list route.
- `src/app/dashboard/wcc/conversations/[id]/page.tsx` — timeline/detail route.
- `src/app/dashboard/wcc/conversations/loading.tsx` — route loading fallback.
- `src/app/dashboard/wcc/layout.tsx` — route WCC nav to conversations without a raw messages menu.
- `src/lib/__tests__/wcc-conversations.test.ts` — focused fallback, mapping, and detail tests.
- `openspec/specs/wcc-command-center/spec.md` — updated source spec after archive.

### Approaches
1. **Dedicated helper with batched enrichment** — Query conversations once, then load related contacts, latest messages, and latest intents in bounded batch queries.
   - Pros: avoids N+1 queries, follows #240/#241 data helper pattern, testable, keeps UI server-rendered.
   - Cons: latest-per-conversation is grouped in application code after a bounded query.
   - Effort: Medium
2. **Inline page queries** — Put all Supabase reads in pages.
   - Pros: fewer new files.
   - Cons: weak testability and duplicated unavailable-state handling.
   - Effort: Low

### Recommendation
Use a dedicated read-only server helper with safe fallbacks, bounded pagination, and batched related rows. Add `/dashboard/wcc/conversations` and `/dashboard/wcc/conversations/[id]`; messages remain detail context only.

### Risks
- Deep OFFSET pagination may degrade later; v1 follows existing WCC page pattern and indexed `last_message_at` ordering.
- Missing WhatsApp tables or partial data must not break WCC navigation.

### Ready for Proposal
Yes — implement read-only grouped conversations and timeline only.
