# Design: WCC Shell and Dashboard

`src/app/dashboard/layout.tsx` links to `/dashboard/wcc`. `src/app/dashboard/wcc/layout.tsx` provides WCC navigation and a return link. `src/app/dashboard/wcc/page.tsx` renders cards and placeholders from `getWccDashboardSummary()`.

Data flow: WCC page → `src/lib/wcc-dashboard.ts` → `isSupabaseConfigured()` → either empty mock-safe summary or read-only Supabase count/recent queries against existing indexed WhatsApp columns (`status`, `last_message_at`). Errors return `isConfiguredButUnavailable` with zero counts.

No client component, Server Action, migration, webhook, sender, or LLM code is changed. Later route targets are represented as same-page placeholders only.
