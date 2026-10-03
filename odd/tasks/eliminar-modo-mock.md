# Feature: eliminar-modo-mock (issue #372)

Refactor(data): eliminar el modo dual mock/Supabase y unificar la capa de
datos sobre Supabase. Serie de 6 fases, un PR por fase.

Decisión confirmada por el usuario (2026-10-02): serie completa fases 1–6,
base de desarrollo Supabase CLI local.

Referencias:
- Issue: https://github.com/eliumontoya/travelhub-app/issues/372
- Antecedente: issue #321 (split e2e mock/preview)

## Tareas

### Fase 1 — Base de desarrollo Supabase local (CLI)
- [x] Estado: completada (revisión nativa aprobada, autoridad quemada)
- Configurar `supabase/config.toml` (proyecto local, puertos estables).
- Aplicar migraciones existentes con `supabase db reset` y validar esquema.
- Crear seed de desarrollo (`supabase/seed.sql`) con datos mínimos: perfiles
  admin/agent, clientes c1/c2, viaje publicado `italia-perez-2026` + draft,
  días, items, suppliers, services, visas.
- Scripts npm: `db:start`, `db:stop`, `db:reset`; documentación en
  architecture.md (entorno local con Supabase CLI).
- Fix de compatibilidad: `0033_site_settings_branding.sql` usaba
  `CREATE POLICY IF NOT EXISTS` (sintaxis PG 18); reescrito como bloque `DO`
  idempotente equivalente para PG 17 local (semántica sin cambios).
- `.gitignore`: ignorar `supabase/.temp/start-secrets/`.
- Commit: `9ca774c` — feat(db): local Supabase dev environment via CLI
  (issue #372 phase 1)
- Nota: hallazgos no bloqueantes de la revisión (follow-ups): version pin de
  PG en config.toml; search_path en uso de `crypt` en seed.sql; validar
  `db reset` en CI en fases 2–3.

### Fase 2 — Migrar tests unitarios fuera de fixtures mock
- [ ] Estado: pendiente
- Inventariar tests de `src/lib/__tests__/`, `src/lib/data/__tests__/` y
  similares que usan `mock-data` (imports directos o comportamiento mock).
- Clasificar: (a) test de lógica pura → reexpresar contra contrato sin mock;
  (b) test que necesita base → correr contra Supabase local (vitest con env
  apuntando a local) o cliente Supabase mockeado.
- CI: job de unit tests con `supabase start` + `db reset` si hace falta base.
- PR 2.

### Fase 3 — Reexpresar el e2e proyecto `mock`
- [ ] Estado: pendiente
- Estrategia: seed de base local + `test:e2e:local` (reemplaza proyecto mock),
  o reducir a solo preview. Decidir según lo que quede vivo tras fases 1–2.
- Actualizar `playwright.config.ts`, scripts npm y CI (e2e-mock job).
- PR 3.

### Fase 4 — Eliminar el switch por módulo en `data/`
- [ ] Estado: pendiente
- Quitar `isSupabaseConfigured()` y ramas mock de los 13 módulos de
  `src/lib/data/` (incluye documents/services/etc.).
- Mantener degradación elegante solo para API keys opcionales (Google Maps,
  Resend, Aviationstack) — mecanismo distinto, sigue vigente.
- PR 4.

### Fase 5 — Limpiar importaciones directas de `mock-data`
- [ ] Estado: pendiente
- `src/middleware.ts`: gate por sesión Supabase únicamente.
- `src/lib/client-auth.ts`: eliminar rama mock.
- `src/lib/auth/roles.ts`: eliminar resolución de cuenta/rol mock.
- Ajustar login page/actions y dashboard layout si quedan ramas mock.
- PR 5.

### Fase 6 — Eliminar `src/lib/mock-data.ts` y actualizar docs
- [ ] Estado: pendiente
- Borrar `src/lib/mock-data.ts`; verificar que no queden imports.
- Actualizar `architecture.md`: modo mock desaparece del contrato; Supabase
  es requisito de desarrollo.
- Criterio de cierre: `npx tsc --noEmit`, `npm run test`, `npm run build` y
  e2e en verde; degradación elegante de API keys opcionales intacta.
- PR 6.

## Registro de trabajo (evidencia)

(cada commit de work unit se registra acá con su hash)
