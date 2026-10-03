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
- [x] Estado: completada (3 lotes, suite 807 tests verde, tsc limpio)
- Inventario: 22 archivos de test afectados (15 con import directo de
  mock-data, 7 forzando isSupabaseConfigured=false), 4 de frontera (fase 5),
  3 falsos positivos.
- Estrategia: contrato con cliente Supabase mockeado (patrón default,
  exemplar site-settings.test.ts); base real local solo donde un mock no
  prueba semántica (auto-create: cascadas FK vía getTestSupabaseClient +
  mock de @/lib/supabase/server). Helper: src/lib/__tests__/helpers/db.ts.
- Batch 1: helper + site-settings, trip/client-cover-image, move-item,
  duplicate-item, structured-items, item-supplier-persistence,
  public-trip-details (sin cambios, falso positivo).
- Batch 2: visas, visa-documents, services, client-portal, client-pin,
  visa-domain-contracts, traveler-activities, client-home-data, profiles,
  data-domain-contracts.
- Batch 3: data.test.ts (fachada: superficie + routing), auto-create.test.ts
  (base real: cascadas FK verificadas con limpieza por marcador), CI: setup
  Supabase CLI + start + db reset antes de Unit Tests con TEST_SUPABASE_*.
- Sin cambios (fase 5): roles.test, client-auth.test, accounts actions.test.
- Hallazgos:
  - Divergencia producción: clients.ts aplica effectiveWhatsapp(whatsapp,
    phone) solo en la rama mock — al eliminar el switch (fase 4) hay que
    computar el fallback también en la rama Supabase. Follow-up fase 4.
  - move-item-to-day: la rama mock tenía un no-op (item inexistente) que no
    existe en el path Supabase real — divergencia del modo dual confirmada.
  - Semánticas RLS/security-definer (traveler activities, ownership de
    documentos) quedan como cobertura de e2e local (fase 3).
- Commits encadenados (candidato dividido por presupuesto de lente):
  - `5fd053b` test(data): migrate small CRUD tests off mock fixtures
  - `251dcfb` test(data): migrate visa domain and traveler activity tests
  - `db5a9d6` test(data): migrate services, client portal, profiles tests
  - `870e00d` test(data): facade contracts, real-DB cascade tests, CI wiring
- Review nativo: C1 (review-1a006a27b98d2bd2), C2 (review-dfd117164edb932c),
  C3 (review-251321c6d5ac0938) aprobados; C4 (review-a74ea29b4be58b20, tier
  high, 4 lentes) aprobado. Autoridades quemadas.
- Follow-ups informativos del review: comentar/anonimizar el JWT local en
  ci.yml (R1-001/R2-inline-local-jwt/R3-CI-2), deduplicar fake client de
  data.test.ts (R2-inline-fake-dup), revisar nombres de marcador de test
  (R2-batch-marker-name), cobertura de superficie de fachada (R3-SURF-1).

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
