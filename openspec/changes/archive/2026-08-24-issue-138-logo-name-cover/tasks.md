# Tasks: Logo y nombre en el cover (issue #138)

- [x] T1: Migración `0033_site_settings_branding.sql` (columnas + bucket `site-assets` + RLS) — verified `supabase/migrations/0033_site_settings_branding.sql:1-23`
- [x] T2: Tipo `SiteSettings` con `agencyName?`/`logoUrl?` (types/index.ts) — verified `src/types/index.ts:281-286`
- [x] T3: `data.ts` — `getSiteSettings`, `updateSiteSettings`, `rowToSiteSettings`, mock y `uploadSiteLogo` — verified `src/lib/data.ts:2966-3028` and `src/lib/mock-data.ts:624-629`
- [x] T4: `settings/actions.ts` — extender `updateSettingsAction` para marca + subida de logo — verified `src/app/dashboard/settings/actions.ts:1-46`
- [x] T5: `SettingsForm.tsx` — inputs de nombre y logo (file + URL manual + preview) — verified `src/app/dashboard/settings/SettingsForm.tsx:1-90`
- [x] T6: Cover `/t/[slug]/page.tsx` — render de logo + nombre de agencia — verified `src/app/t/[slug]/page.tsx:94-110`
- [x] T7: Verificar `npx tsc --noEmit` y `npm run build`; corregir errores — both pass; `npm run test` passes (106 tests)
