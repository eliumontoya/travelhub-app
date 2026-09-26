# Restore agent permissions menu

## Objective
Restore the administrator navigation entry to the existing per-agent permissions screen without regressing the redesigned dashboard.

## Problem
`/dashboard/settings/accounts` remains implemented and protected by the admin role, but the dashboard redesign removed its menu entry.

## Scope and constraints
- Preserve the current dashboard visual system and all existing navigation behavior.
- Add only an admin-visible link to the existing route.
- Do not change permissions, data, RLS, or account roles.
- TDD mode: enabled by project instruction; runner: npm test.
- Delivery strategy: ask-on-risk. Forecast: under 400 authored lines.

## Tasks
- [x] APM-001 — Restore the admin-only "Cuentas" navigation entry using the current dashboard menu design.
  - Route: delegated (writer trigger: source edit plus focused test/proof).
  - Acceptance: admins can reach `/dashboard/settings/accounts`; non-admin behavior and redesigned menu remain unchanged.
  - Checks: focused relevant tests; `npm test`; visual/source structural readback.
  - Verification: RED — `npm test -- src/app/dashboard/__tests__/layout.test.tsx` failed because the expected `/dashboard/settings/accounts` link was absent. GREEN — the same command passed (2 tests); `npm test` passed (96 files, 675 tests); `npx tsc --noEmit` passed.
  - Structural readback: `Cuentas` preserves the existing redesigned menu styling and is inside the existing `isAdmin` block; Dashboard, Viajes, Clientes, Proveedores, Agentes, WhatsApp C.C., and Ajustes remain covered by the focused test.
  - Commit evidence: this work-unit commit (`fix(dashboard): restore agent permissions navigation`).

## Progress
APM-001 is complete; commit identity will be recorded after the work-unit commit.

## Next step
No remaining implementation tasks.
