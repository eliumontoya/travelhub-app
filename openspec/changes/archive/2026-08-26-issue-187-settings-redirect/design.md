# Design: issue-187-settings-redirect

## Architecture

Keep the existing chain: `SettingsForm` client leaf → route-local Server Action → `src/lib/data.ts` → redirect to dashboard. `useActionState` remains for failed saves; successful saves navigate away and return no form state.

## Server Action Flow

Update `updateSettingsAction`:

1. Parse and validate fields as today.
2. Return `{ error }` before mutation for invalid input.
3. Upload logo inside the existing `try/catch`; return `{ error }` on upload failure.
4. Await `updateSiteSettings(...)`.
5. Revalidate `/dashboard/settings` and `/t/[slug]`.
6. Call `redirect('/dashboard?settingsSaved=1')` outside any `try/catch`.

This follows Next 16.2.10 docs: revalidate before redirect; do not catch the redirect control-flow exception.

## Dashboard Confirmation

`src/app/dashboard/page.tsx` accepts promise-based `searchParams` like other routes. A helper checks whether the first `settingsSaved` value is `"1"`. When true, render a green `role="status"` alert with `Configuración guardada correctamente.`

## Verification Strategy

- Focused Vitest tests for valid save redirect and invalid email no redirect/persist.
- Helper test for success-marker parsing.
- Full `npx tsc --noEmit`, `npm test`, and `npm run build`.
