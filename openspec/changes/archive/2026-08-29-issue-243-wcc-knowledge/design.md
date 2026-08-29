# Design: WCC Knowledge Entries Management

## Overview
Add PR 5/6 WCC slice for `whatsapp_knowledge_entries` management. This is the only WCC v1 mutation surface for WhatsApp data; contacts, escalations, conversations, messages, and intents remain read-only.

## Data Access and Validation
- `src/lib/wcc-knowledge.ts` owns list/detail reads and validated writes.
- Reads validate `page` and allowlist `status` (`draft`, `approved`, `archived`), select only required columns, order by `updated_at desc`, and use bounded ranges.
- Mutations normalize `topic`, `question`, `answer`, `tags`, `source`, and `status` server-side before any Supabase call.
- Validation rejects missing required fields, unsupported status values, overlong topic/question/answer/source/tags, and empty entry ids.
- `approved_at` is set to the current ISO timestamp when status is `approved`; it is cleared for `draft` and `archived`.
- Supabase-unconfigured reads return safe empty states; writes return safe error states instead of throwing.

## UI and Actions
- `/dashboard/wcc/knowledge` is a Server Component that awaits promise-based `searchParams`, renders status filter links, the create form, rows, status controls, and pagination.
- `/dashboard/wcc/knowledge/[id]` is a Server Component that awaits promise-based `params` and renders the edit form for one entry.
- `actions.ts` uses top-level `"use server"`, calls the helper, and revalidates `/dashboard/wcc`, `/dashboard/wcc/knowledge`, and entry detail routes.
- Small client components use `useActionState` to display validation/mutation feedback while keeping DB access server-only.

## Supabase/Postgres Notes
Existing schema already enables RLS, revokes anon access, grants authenticated access, includes authenticated policies with `USING` and `WITH CHECK`, and indexes status/topic/tags. No migration is needed for #243.

## Non-goals
- No delete operation.
- No changes to inbound agent logic; it already reads only approved entries.
- No mutations for any other WhatsApp table.

## Verification
Focused Vitest for helper validation/mutations, then TypeScript, lint, full unit tests, build, and e2e smoke.
