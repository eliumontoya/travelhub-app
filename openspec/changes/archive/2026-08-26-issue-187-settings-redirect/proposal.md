# Proposal: issue-187-settings-redirect

## Intent

Redirect the agent from `/dashboard/settings` to `/dashboard` after a successful settings save, and show a dashboard success confirmation.

## What Changes

- Successful `updateSettingsAction` path persists, revalidates, then redirects to `/dashboard?settingsSaved=1`.
- `/dashboard` shows `Configuración guardada correctamente.` only for `settingsSaved=1`.
- Tests cover successful redirect and invalid-save no redirect.
- Archive the requirement into `openspec/specs/dashboard-workspace/spec.md`.

## What Stays The Same

- Invalid email/phone and logo upload failures remain inline form errors.
- Persistence stays in `updateSiteSettings`/`uploadSiteLogo` via `src/lib/data.ts`.
- Public page revalidation remains `revalidatePath('/t/[slug]', 'page')`.
- No schema/RLS change.

## Scope Boundaries

In scope: settings success redirect, dashboard confirmation, focused tests, OpenSpec archive.

Out of scope: shared toast system, client-side router navigation, new settings fields, auto-clearing the query param.

## Rollback Plan

Revert the touched code and remove the archived spec requirement. No data repair is required.
