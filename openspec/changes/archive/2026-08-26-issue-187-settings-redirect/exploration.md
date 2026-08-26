# Exploration: issue-187-settings-redirect

## Current State

`/dashboard/settings` uses `SettingsForm` with `useActionState(updateSettingsAction, null)`. The Server Action validates email/phone, optionally uploads a logo, calls `updateSiteSettings`, revalidates `/dashboard/settings` and `/t/[slug]`, then returned `null` before this change. `/dashboard` had no success flash handling.

## Docs Read

- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md`
- `node_modules/next/dist/docs/01-app/02-guides/server-actions.md`

Findings: Server Action redirects return 303; `redirect()` throws; revalidation must happen before `redirect()`; keep redirects outside `try/catch`.

## Affected Areas

- `src/app/dashboard/settings/actions.ts` — redirect on successful save.
- `src/app/dashboard/page.tsx` — read success marker and show confirmation.
- `src/lib/dashboard-flash.ts` — testable success-marker parser.
- Focused Vitest tests for success redirect and failed-save no redirect.
- `openspec/specs/dashboard-workspace/spec.md` — archived behavior.

## Risks

- Catching `redirect()` would convert success into a false error; keep it outside upload `try/catch`.
- Showing success without an explicit marker would create false positives after failed saves/direct navigation.
