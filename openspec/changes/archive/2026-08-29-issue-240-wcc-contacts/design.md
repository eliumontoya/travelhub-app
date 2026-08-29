# Design: WCC Contacts List and Detail

`src/app/dashboard/wcc/layout.tsx` points Contactos to `/dashboard/wcc/contacts`. `src/app/dashboard/wcc/contacts/page.tsx` reads `searchParams` (promise per Next 16 docs), normalizes page numbers, and renders a paginated list. `src/app/dashboard/wcc/contacts/[id]/page.tsx` awaits `params`, loads the detail, and renders read-only context cards.

Data flow: WCC contacts pages → `src/lib/wcc-contacts.ts` → `isSupabaseConfigured()` → empty mock-safe state or read-only Supabase queries. The list uses indexed `last_message_at`/`created_at` ordering plus `.range()`. Detail queries one contact and limited related conversations, escalations, and intents by indexed `contact_id` fields. All helper errors return `isConfiguredButUnavailable` instead of crashing.

No Server Actions, mutations, migrations, webhook, LLM, escalations queue, conversations main view, or knowledge CRUD are added.
