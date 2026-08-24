# Tasks: Logo y nombre en el cover (issue #138)

- [ ] T1: Migración `0031_site_settings_branding.sql` (columnas + bucket `site-assets` + RLS)
- [ ] T2: Tipo `SiteSettings` con `agencyName?`/`logoUrl?` (types/index.ts)
- [ ] T3: `data.ts` — `getSiteSettings`, `updateSiteSettings`, `rowToSiteSettings`, mock y `uploadSiteLogo`
- [ ] T4: `settings/actions.ts` — extender `updateSettingsAction` para marca + subida de logo
- [ ] T5: `SettingsForm.tsx` — inputs de nombre y logo (file + URL manual + preview)
- [ ] T6: Cover `/t/[slug]/page.tsx` — render de logo + nombre de agencia
- [ ] T7: Verificar `npx tsc --noEmit` y `npm run build`; corregir errores
