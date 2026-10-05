# Tasks: E2E Local estable en CI

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~460 (rango 420–520) |
| 400-line budget risk | Medium |
| 800-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | 1 PR con commits por unidad de trabajo (work-unit commits) |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

### Suggested Work Units

| Unidad | Objetivo | PR probable | Líneas estimadas | Esfuerzo | Comando de test enfocado | Rollback boundary |
|--------|----------|-------------|------------------|----------|--------------------------|-------------------|
| 1 | Helpers REST + sufijo único | PR 1 | ~70 | ~1.5 h | `npx tsc --noEmit` | `e2e/local/helpers.ts` (solo adiciones) |
| 2 | Supplier: nombres únicos + limpieza | PR 1 | ~70 | ~1.5 h | `npx playwright test --project=local supplier-item-compatibility` | `e2e/local/supplier-item-compatibility.spec.ts` |
| 3 | Traveler activities: títulos únicos + localizadores + limpieza | PR 1 | ~130 | ~3 h | `npx playwright test --project=local traveler-activities` | `e2e/local/traveler-activities.spec.ts` |
| 4 | Service documents: restauración de checklist | PR 1 | ~55 | ~1.5 h | `npx playwright test --project=local service-documents` | `e2e/local/service-documents.spec.ts` |
| 5 | Create trip: limpieza viaje + cliente | PR 1 | ~40 | ~1 h | `npx playwright test --project=local create-trip` | `e2e/local/create-trip.spec.ts` |
| 6 | Warmup: `globalSetup` + wiring | PR 1 | ~60 | ~1.5 h | `npm run test:e2e -- --project=local` | `e2e/global-setup.ts`, `playwright.config.ts` |
| 7 | Docs: `architecture.md` + chequeo `README.md` | PR 1 | ~10 | ~0.5 h | revisión de diff | `architecture.md` (sección e2e) |
| 8 | Verificación: doble corrida + typecheck + lint + CI | — | 0 | ~2 h | ver Fase 8 | — |

**Esfuerzo total estimado**: ~12.5 h de trabajo de agente (~1.5–2 días de calendario con revisión).

## Fases

### Fase 1 — Helpers REST y nombres únicos (WU1)

- [x] 1.1 En `e2e/local/helpers.ts`, agregar `LOCAL_SUPABASE_SERVICE_ROLE_KEY` leyendo `process.env.SUPABASE_SERVICE_ROLE_KEY` con fallback a la clave demo local (misma que ya inyecta `playwright.config.ts` en el `env` del `webServer`).
- [x] 1.2 Agregar `uniqueSuffix(): string` (basado en `Date.now().toString(36)`) y `uniqueName(base: string): string` (concatena el sufijo, manteniendo el prefijo legible).
- [x] 1.3 Agregar `deleteRowsByEq(request, table, column, value)` — `DELETE` contra `${LOCAL_SUPABASE_URL}/rest/v1/${table}?${column}=eq.${value}` con headers service-role (`apikey` + `Authorization: Bearer`), `Prefer: return=representation`, y devolución del número de filas borradas.
- [x] 1.4 Agregar `deleteRowsByNameLike(request, table, column, pattern)` — mismo patrón con `Prefer: return=representation` / filtro `like.` (`*` como wildcard PostgREST) para borrados por prefijo del propio spec. Se agrega un `extraFilters` opcional a `deleteRowsByEq`/`deleteRowsByNameLike` para acotar por más de una columna (p. ej. `trip_day_id` del seed).
- [x] 1.5 Agregar `patchRowsByEq(request, table, column, value, body)` — `PATCH` con `Content-Type: application/json`, `Prefer: return=representation` (necesario para la restauración de checklist).
- [x] 1.6 No modificar el contrato de `findSupplierIdByName`, `loginAs*`, `signInClient`, `logoutClient`, `setClientPin` ni `ensureTripStatus`.
- [x] 1.7 Verificar: `npx tsc --noEmit` pasa.

### Fase 2 — `supplier-item-compatibility.spec.ts` (WU2)

- [x] 2.1 Agregar `test.beforeEach` que borre residuos: `deleteRowsByNameLike(request, "suppliers", "name", "Same Session Tour Operator*")`. El proveedor residual del propio spec es el que hoy rompe `toHaveCount(2)`.
- [x] 2.2 Reemplazar el nombre fijo `"Same Session Tour Operator"` por `uniqueName("Same Session Tour Operator")` y usar esa variable en el fill, la aserción de valor del combobox y el `toContainText`.
- [x] 2.3 Acotar la aserción del catálogo (`await expect(options).toHaveCount(2)`) al catálogo base, excluyendo cualquier proveedor creado por el propio spec (filtro `hasNotText` por el prefijo legible). Conserva la cobertura de: solo proveedores activos y compatibles con la categoría, sin `Grand Fiesta Americana` ni `María Sazón`.
- [x] 2.4 Agregar `test.afterAll` que borre el proveedor creado por id (`deleteRowsByEq(request, "suppliers", "id", createdSupplierId)`), sosteniendo el id entre tests vía variable de módulo.
- [x] 2.5 Verificar (RED→GREEN): `npx playwright test --project=local supplier-item-compatibility` en dos corridas seguidas sin `db:reset` pasa; el conteo de opciones ya no crece en la segunda.

### Fase 3 — `traveler-activities.spec.ts` (WU3)

- [x] 3.1 Definir los títulos con sufijo único por corrida: `uniqueName("E2E paseo por Trastevere")`, `uniqueName("E2E cena en Trastevere")`, `uniqueName("E2E actividad de Ana")`.
- [x] 3.2 Agregar `test.beforeEach` que borre actividades residuales del día del seed (`deleteRowsByNameLike(request, "items", "title", "E2E *")`, acotado al `trip_day_id` del seed para no tocar items de otros días). Nota: la tabla real es `items` (migración `0001_init.sql`), no `trip_items`.
- [x] 3.3 Reemplazar el localizador posicional `page.getByText("Ver más detalles").nth(2)` por uno acotado a la fila del título único del test (`activityCard(page, title)`).
- [x] 3.4 Reemplazar los `.last()` de la variante mobile (`getByText("Editar actividad")`, `details input[name=title]`, `details input[name=startTime]`, `getByRole("button", { name: "Guardar cambios" })`, `getByRole("button", { name: "Eliminar" })`) por localizadores acotados a la fila del título único.
- [x] 3.5 Arreglar el localizador del formulario de alta dentro de `expandActivityForm` para que no choque con los `details input[name=title]` de actividades existentes del mismo día (scoping al panel del formulario de alta, no al día entero).
- [x] 3.6 Agregar `test.afterAll` que borre las actividades creadas por el spec (por prefijo `E2E *` del día del seed), sin depender de que el borrado por UI haya corrido.
- [x] 3.7 Verificar (RED→GREEN): `npx playwright test --project=local traveler-activities` en dos corridas seguidas sin `db:reset` pasa; el `strict mode violation` de `input[name=title]` no reaparece.
- [x] 3.8 **Desviación del plan (agregada)**: el test 3 asigna `SEED.secondClient` al viaje seed, lo que auto-crea una fila en `services`; sin limpiarla, la segunda corrida deja un segundo viajero y rompe `service-documents` (localizador `Documentos` duplicado) y el propio test 3 (el buscador de "Gestionar clientes" oculta al cliente ya asignado). Se agrega `resetSeedTripAssignment(request)` en `beforeEach` + `afterAll` que borra `services` y `trip_clients` de `secondClient` en el viaje seed.

### Fase 4 — `service-documents.spec.ts` (WU4)

- [ ] 4.1 Agregar `test.beforeEach` que borre el documento solicitado residual: `deleteRowsByEq(request, "service_checklist_items", "label", "Copia de pasaporte")` (su upload cae por `on delete cascade`).
- [ ] 4.2 Agregar en el mismo `beforeEach` la restauración de `Seguro de viaje`: `patchRowsByEq(request, "service_uploads", "checklist_item_id", "5c220000-0000-4000-8000-000000000002", { status: "uploaded" })`.
- [ ] 4.3 No tocar las aserciones de comportamiento: `1/3 revisados`, `1 pendiente de revisión`, `Seguro de viaje` oculto antes del lazy load, foco/`Escape` del diálogo, `2/3 revisados`, `2/4 revisados`, y las aserciones del viaje archivado.
- [ ] 4.4 Verificar (RED→GREEN): `npx playwright test --project=local service-documents` en dos corridas seguidas sin `db:reset` pasa; las aserciones iniciales se sostienen.

### Fase 5 — `create-trip.spec.ts` (WU5)

- [ ] 5.1 Mantener el título único existente (`E2E Roadtrip ${uniqueSuffix()}`) y documentar que es la clave de limpieza.
- [ ] 5.2 Agregar `test.afterAll` que borre el viaje creado por id (`deleteRowsByEq(request, "trips", "id", tripId)`) y el cliente creado por email (`deleteRowsByEq(request, "clients", "email", "e2e-new-client@example.com")`, ajustando si el email debe llevar sufijo único para no borrar un cliente ajeno).
- [ ] 5.3 Conservar el resto del flujo y aserciones (guard de clientes, itinerario, publicación, vista pública, portal del cliente, vuelta a borrador).
- [ ] 5.4 Verificar (RED→GREEN): `npx playwright test --project=local create-trip` en dos corridas seguidas sin `db:reset` pasa y no deja viaje ni cliente.

### Fase 6 — Warmup del `webServer` (WU6)

- [ ] 6.1 Crear `e2e/global-setup.ts` con `export default async function globalSetup()` que: si `process.env.BASE_URL` está definido, retorna sin hacer nada; en caso contrario crea un `APIRequestContext` con `baseURL: "http://localhost:3000"` y timeout acotado, y hace GET a `/login`, `/dashboard` y `/t/${SEED.tripSlug}`.
- [ ] 6.2 El warmup NO debe abortar la suite si un GET falla (el `webServer` ya validó su `url`); capturar el error y continuar.
- [ ] 6.3 En `playwright.config.ts`, agregar `globalSetup: "./e2e/global-setup.ts"`.
- [ ] 6.4 En `playwright.config.ts`, agregar un comentario sobre `retries: process.env.CI ? 2 : 0` que explique que los specs son idempotentes desde el issue #406 y que por eso el retry arranca limpio (D7).
- [ ] 6.5 Verificar: `npm run test:e2e -- --project=local` pasa; el log del `webServer` no muestra compilación on-demand de `/login`, `/dashboard` ni `/t/...` durante el primer test.

### Fase 7 — Documentación (WU7)

- [ ] 7.1 Reescribir la sección e2e de `architecture.md` (~líneas 365-368): la suite ya es idempotente; `npm run db:reset` **ya no es requisito** entre corridas repetidas (referenciar issue #406).
- [ ] 7.2 Documentar en `architecture.md` el pre-calentamiento del `webServer` (`globalSetup`) y la nota de que `[WebServer] ⨯ Error: The destination stream closed early` es ruido benigno de abort de streaming, salvo que el servidor deje de responder.
- [ ] 7.3 Verificar la tabla de fuente de verdad de `README.md`: la fila "Tests" apunta a `architecture.md`; confirmar que no requiere edición y dejar constancia en el PR.
- [ ] 7.4 Verificar que no quede ninguna mención obsoleta a "hay que restaurar primero con `npm run db:reset`" para la suite e2e.

### Fase 8 — Verificación (WU8)

- [ ] 8.1 `npx tsc --noEmit` — sin errores de tipo.
- [ ] 8.2 `npm run lint` — sin errores nuevos.
- [ ] 8.3 `npm run test:e2e -- --project=local` **sin `db:reset`** (primera corrida) — verde.
- [ ] 8.4 `npm run test:e2e -- --project=local` **sin `db:reset`** (segunda corrida, con residuos de la primera) — verde. Este es el criterio central del issue.
- [ ] 8.5 Forzar un reintento (fallo inducido temporalmente en una aserción de un spec del issue con `--retries=1`) y confirmar que el intento 2 arranca limpio; luego revertir el fallo inducido.
- [ ] 8.6 Confirmar en CI que el job `e2e-local` queda verde en `main` tras el merge.
- [ ] 8.7 Reportar evidencia por comando (comando exacto + resultado observado) y cualquier fallo preexistente no atribuible a este cambio.
