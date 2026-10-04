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
- [x] Estado: completada (e2e local 30/30 en verde, unit 807, tsc limpio)
- Proyecto Playwright `mock` → `local` (testDir e2e/local, workers 1);
  scripts `test:e2e`/`test:e2e:local`; webServer arranca con env local de
  Supabase (URL/anon/service-role demo del CLI).
- 9 specs reescritos a flujos reales: login admin/agent vía /login,
  portal cliente con PIN (c1/c2), RPC real de actividades del viajero;
  helpers compartidos en e2e/local/helpers.ts. Sin cookie
  x-mock-account-id.
- CI: job `e2e-mock` → `e2e-local` con Supabase CLI + `supabase start` +
  `db reset`; preview intacto.
- Fixes de bugs reales del path Supabase (enmascarados por el mock):
  - `getVisasByClientId` (visas.ts) → service role: el portal autentica con
    PIN propio, RLS no puede acotar (20260930000000 revoca visa_clients a
    anon); degrada a [] sin service key.
  - `/c/[slug]` 500 → migración 20260930010000: grant column-level anon
    SELECT en clients.cover_image_url (público por diseño, la página lo
    renderiza como fondo).
- Unit tests afectados actualizados: playwright-config (proyecto local),
  env SUPABASE_SERVICE_ROLE_KEY en visas.test.ts y data.test.ts (patrón de
  client-portal/services tests).
- Commit: `38a64ce` — test(e2e): re-express mock project as seeded local
  Supabase suite (issue #372 phase 3). PR #390 (apilado sobre #389).
  Review nativo: review-565e651b77c3967a (tier high, 4 lentes) aprobado.

### Fase 4 — Eliminar el switch por módulo en `data/`
- [x] Estado: completada (3 lotes, `src/lib/data/` libre de mock-data)
- Lote A `8d3cd24`: 14 módulos medianos (clients, suppliers, travel-agents,
  profiles, settings, feedback, trip-templates, trip-packing,
  trip-reminders, trip-history, trip-days, services, service-shared,
  dashboard) + fix `effectiveWhatsapp` en clients.ts (createClient escribe
  el fallback; updateClient lee el phone actual solo si el patch lo omite).
- Lote B `be6e1a7`: trips (6), trip-items (12), trip-queries (6),
  documents (20); Storage mocks eliminados; page test de documents sincronizado
  vía boundary mock de getTripById.
- Lote C `7e81da7`: visas (9), visa-documents (11), service-documents (6),
  service-checklist (8); criterio de salida: `git grep mock-data` en
  src/lib/data/ sin resultados.
- No-ports deliberados (stance Supabase como requisito): updateVisa ya no
  recorta notes; updateChecklistItem con id inexistente es no-op; guards de
  env no configurado eliminados de lecturas/URLs firmadas; createItem
  mantiene `sort_order ?? 0` (el default por count del mock no se porta).
- Tests: 799/808 (solo client-auth.test.ts en rojo conocido, fase 5);
  tsc limpio; note-write-sanitization migrado a contrato.
- Commits revisados y quemados: lote A review-d39830959bd8d784, lote B
  review-5231efaa12584fda, lote C review-1ce0892b0100dd7e.
- Follow-ups informativos: extra read en updateClient para el fallback de
  whatsapp; service-shared ya no pre-chequea el switch; barrel
  importActual en el page test; guards de degradación eliminados en
  trip-queries/trip-items/trips/documents/visa-documents/service-documents.

### Fase 5 — Limpiar importaciones directas de `mock-data`
- [x] Estado: completada (PR #392 fusionado; verificación posterior 2026-10: `grep mock` en middleware/client-auth/roles sin resultados)

### Fase 6 — Eliminar `src/lib/mock-data.ts` y actualizar docs
- [x] Estado: completada (criterio de cierre íntegro en verde)
- Borrado `src/lib/mock-data.ts`; `git grep mock-data -- src/` sin resultados.
- `architecture.md`: modo dual/mock eliminado del contrato (frontera, tabla
  de módulos, estructura de carpetas, deploy local); Supabase es requisito;
  referencia al entorno local CLI.
- Verificación final: `npx tsc --noEmit` limpio; `npm run test` 804/804;
  `npm run build` verde (requiere env de Supabase: `.env.local` local;
  el build sin env ya no prerrenderiza — el mock lo hacía posible y el
  issue lo elimina deliberadamente); `supabase db reset` + e2e local 30/30.
- Commit: (ver abajo, fase 6).

## Registro de trabajo (evidencia)

(cada commit de work unit se registra acá con su hash)
