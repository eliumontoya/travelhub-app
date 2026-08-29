# Exploration: WCC Shell and Dashboard

Current dashboard routes live under `src/app/dashboard` with a shared authenticated layout. WhatsApp tables/types already exist from earlier work, but no WCC UI exists.

Affected areas: `src/app/dashboard/layout.tsx`, new `src/app/dashboard/wcc/*`, new `src/lib/wcc-dashboard.ts`, focused tests, and a new `wcc-command-center` spec.

Recommended approach: add a read-only App Router WCC shell plus a safe summary helper that returns zeros in mock/unconfigured mode and catches missing Supabase table errors. Defer all contacts/escalations/conversations/knowledge CRUD to later issues.

Risks: configured dev databases may lack WhatsApp tables; the helper renders a safe unavailable empty state. Nested `/dashboard/wcc` remains protected by existing `/dashboard/**` middleware.
