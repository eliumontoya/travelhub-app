# Apply Progress: Logo y nombre en el cover (issue #138)

**Change**: issue-138-logo-name-cover  
**Mode**: Strict TDD (reconciliation of already-merged PR #143)  
**Merged commit**: `0bcc1f2` — `Merge pull request #143 from eliumontoya/feat/issue-138-logo-name-cover`  
**Actual migration on disk**: `supabase/migrations/0033_site_settings_branding.sql` (renumbered from `0031` in design.md/tasks.md to avoid the batch collision).

## Task Completion

- [x] T1: Migración `0033_site_settings_branding.sql` (columnas + bucket `site-assets` + RLS)
- [x] T2: Tipo `SiteSettings` con `agencyName?`/`logoUrl?` (types/index.ts)
- [x] T3: `data.ts` — `getSiteSettings`, `updateSiteSettings`, `rowToSiteSettings`, mock y `uploadSiteLogo`
- [x] T4: `settings/actions.ts` — extender `updateSettingsAction` para marca + subida de logo
- [x] T5: `SettingsForm.tsx` — inputs de nombre y logo (file + URL manual + preview)
- [x] T6: Cover `/t/[slug]/page.tsx` — render de logo + nombre de agencia
- [x] T7: Verificar `npx tsc --noEmit` y `npm run build`; corregir errores

## File:Line Evidence

| Task | File | Lines | Evidence |
|---|---|---|---|
| T1 | `supabase/migrations/0033_site_settings_branding.sql` | 1-23 | Adds `agency_name`/`logo_url` columns; creates public `site-assets` bucket; adds owner-write + public-read storage policies. |
| T2 | `src/types/index.ts` | 281-286 | `SiteSettings` interface includes `agencyName?: string` and `logoUrl?: string`. |
| T3 | `src/lib/data.ts` | 2966-3028 | `getSiteSettings`, `updateSiteSettings`, `rowToSiteSettings`, and `uploadSiteLogo` implemented; `SITE_ASSETS_BUCKET = "site-assets"`. |
| T3 | `src/lib/mock-data.ts` | 624-629 | `mockSiteSettings` seeded with empty `agencyName`/`logoUrl`. |
| T4 | `src/app/dashboard/settings/actions.ts` | 1-46 | `updateSettingsAction` reads `agencyName`, handles `logo` file via `uploadSiteLogo`, preserves `logoUrl`, validates email/phone, revalidates `/t/[slug]`. |
| T5 | `src/app/dashboard/settings/SettingsForm.tsx` | 1-90 | `encType="multipart/form-data"`; inputs for `agencyName`, file `logo`, manual `logoUrl`, and live preview. |
| T6 | `src/app/t/[slug]/page.tsx` | 94-110 | Cover hero renders logo + agency name in top-left when present; hidden when absent. |

## TDD Cycle Evidence

This is a **reconciliation of code already merged to `main`**. No new production code was written during this apply batch, so the strict RED → GREEN → REFACTOR cycle could not be executed for new implementation. Verification was performed against the merged implementation plus the existing test/build harness.

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| T1 | N/A — migration already applied on disk | Migration file `0033_site_settings_branding.sql` present and matches design (bucket + RLS + columns). | N/A |
| T2 | N/A — type already merged | `SiteSettings` type includes optional `agencyName`/`logoUrl`. | N/A |
| T3 | **Coverage gap**: no dedicated unit tests for `getSiteSettings` / `updateSiteSettings` / `uploadSiteLogo` in `src/lib/__tests__/data.test.ts`. | Implementation in `src/lib/data.ts` compiles and `npm run test` passes (106 tests). | N/A |
| T4 | N/A — server action already merged | `updateSettingsAction` compiles and builds. | N/A |
| T5 | N/A — form already merged | `SettingsForm.tsx` compiles and builds. | N/A |
| T6 | N/A — cover already merged | Cover branch renders conditionally; `npm run build` passes. | N/A |
| T7 | N/A | `npx tsc --noEmit` exits 0; `npm run build` succeeds; `npm run test` passes. | N/A |

## Verification Results

```text
npx tsc --noEmit   → exit 0 (no output)
npm run build      → success (Next.js 16.2.10, 13 pages generated)
npm run test       → 17 passed, 106 tests passed (Vitest)
```

## Issues / Coverage Gaps

- **Coverage gap**: `getSiteSettings`, `updateSiteSettings`, and `uploadSiteLogo` do not have dedicated unit tests. `src/lib/__tests__/data.test.ts` does not reference site-settings functions. The change is protected indirectly by `npm run build` and `npm run test`, but a future verify/apply batch should add focused data-layer tests.
- The migration filename on disk (`0033`) differs from the design/tasks reference (`0031`) to avoid a batch collision; the schema and RLS match the design exactly.

## Deviations from Design

None — the merged implementation matches `design.md`. The only variance is the migration number, which is an intentional renumbering.

## Delivery Boundary

- **Strategy**: `single-pr` + `exception-ok`
- **PR**: #143 already merged to `main`
- No source modifications were made during reconciliation beyond marking `tasks.md` complete and persisting this progress artifact.
