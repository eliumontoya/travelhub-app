# Design: E2E Local estable en CI

## Technical Approach

Estabilizar el arnés `e2e/local` sin tocar producto ni cobertura. Las cuatro palancas son:

1. **Estado de datos**: cada spec que muta estado restaura en `beforeEach` el estado de seed de *sus* datos y limpia al final. Esto vuelve seguros los reintentos, porque `beforeEach` corre en cada intento.
2. **Nombres únicos por corrida**: las entidades nuevas llevan sufijo único, de modo que una corrida repetida o un intento reintentado nunca colisionan con residuos.
3. **Localizadores robustos**: se eliminan posicionales (`nth`, `.last()`) en los specs frágiles y se acotan por el título propio del spec.
4. **Pre-calentamiento del dev-server**: un `globalSetup` golpea las rutas principales con GETs antes del primer test, moviendo la compilación on-demand fuera de la ventana de cada test.

El mecanismo de limpieza sigue el patrón ya existente de `findSupplierIdByName`: Playwright `APIRequestContext` contra el REST de Supabase local. Se agrega la clave service-role (ya inyectada por el `env` del `webServer`) porque los POST/DELETE por REST con la anon key no alcanzan bajo RLS.

`strict_tdd`: la suite e2e es el propio test de comportamiento de este cambio. No hay tests unitarios nuevos aplicables; el ciclo RED/GREEN se observa ejecutando el spec que antes fallaba en re-corridas (ver Testing Strategy).

## Architecture Decisions

### Decision: Clean-before-act en `beforeEach` + limpieza al final (D1)

**Choice**: Cada spec que muta estado define en `beforeEach` la restauración del estado de seed de los datos que posee, y además borra lo que creó (`afterEach`/`afterAll`). Se aplican las dos cosas: borrar por nombre conocido al inicio (cinturón) y borrar al final (tirantes).

**Alternatives considered**:
- *Solo limpiar al final (`afterAll`)* — rechazado: si el intento 1 falla antes del teardown, el intento 2 hereda la suciedad. Es exactamente el fallo de `retries: 2` que el issue documenta.
- *Solo `globalSetup` que resetee la base* — rechazado: el reset global es caro y borra estado que otros specs usan a mitad de corrida; además no protege entre reintentos del mismo test.
- *Depender de `npm run db:reset` antes de cada corrida* — rechazado: es la práctica actual y justamente lo que el issue pide eliminar.

**Rationale**: `beforeEach` es el único punto que corre antes de *cada* intento de un test, incluidos los reintentos. Restaurar ahí convierte el retry en un arranque limpio sin resetear la base completa ni coordinar specs entre sí.

### Decision: Nombres únicos por corrida vía helper (D2)

**Choice**: Un helper `uniqueSuffix()`/`uniqueName(base)` en `e2e/local/helpers.ts` que produce un sufijo por corrida (`Date.now().toString(36)`). Las entidades nuevas usan `uniqueName("Same Session Tour Operator")`, `uniqueName("E2E paseo por Trastevere")`, etc.

**Alternatives considered**:
- *Nombres fijos con limpieza estricta* — rechazado como única defensa: si la limpieza falla una vez, los residuos con nombre fijo rompen las aserciones de conteo de la siguiente corrida.
- *UUID aleatorio por entidad* — rechazado: rompe la legibilidad del reporte y las aserciones de prefijo por texto.

**Rationale**: El sufijo por corrida desacopla la correctitud del éxito de la limpieza previa (defensa en profundidad). Los prefijos legibles se conservan para que las aserciones y el reporte sigan siendo entendibles.

### Decision: Localizadores no posicionales acotados por título propio (D3)

**Choice**: Reemplazar los posicionales de los specs frágiles — `page.getByText("Ver más detalles").nth(2)`, `mobile.getByText("Editar actividad").last()`, `mobile.locator("details input[name=title]").last()` y `mobile.getByRole("button", { name: "Eliminar" }).last()` — por localizadores acotados a la fila del título único creado por ese mismo test.

**Alternatives considered**:
- *Mantener posicionales y arreglar solo el conteo de datos* — rechazado: un residuo ajeno al spec (p. ej. de una corrida interrumpida) seguiría desplazando el `nth`.
- *Usar `getByTestId`* — rechazado: no existe infraestructura de test ids en los componentes y agregarla sería cambiar producto por un problema de test.

**Rationale**: Acotar por el título propio hace que la selección dependa del dato que el spec controla, no de la posición ordinal entre filas que no controla. El fallo reportado (`input[name=title]` → 2 elementos) es precisamente un choque entre el input de la actividad residual y el del formulario expandido.

### Decision: Restauración de estado de `service-documents` vía REST (D4)

**Choice**: En `beforeEach`, borrar cualquier `service_checklist_items` residual con `label = 'Copia de pasaporte'` (el `on delete cascade` de `service_uploads.checklist_item_id` arrastra su upload) y, con el id determinista del seed `5c220000-0000-4000-8000-000000000002` (`Seguro de viaje`), hacer PATCH de `service_uploads.status` a `uploaded`.

**Alternatives considered**:
- *Restaurar por la UI* — rechazado: la UI solo ofrece "Marcar como revisado"; no existe acción de "des-revisar", así que el estado no es restaurable por UI.
- *Resetear toda la tabla `service_uploads`* — rechazado: rompería el otro upload del seed (`Pasaporte`, `processed`) y con él la aserción `1/3 revisados`.

**Rationale**: El conteo `1/3 revisados` depende de contar `status in ('reviewed','processed')` sobre los uploads del servicio (`src/lib/data/service-documents.ts`). Devolver `Seguro de viaje` a `uploaded` y quitar el cuarto ítem restaura exactamente la base del conteo, sin tocar el resto del seed. El id del seed es determinista (`supabase/seed.sql`), así que el PATCH es preciso y no por patrón difuso.

### Decision: Higiene de `create-trip` con `afterAll` REST (D5)

**Choice**: `afterAll` borra el viaje creado (por `id`) y el cliente nuevo (por email único derivado del título, ya único por corrida), vía REST service-role. Se mantiene la tolerancia actual a nombres únicos (`E2E Roadtrip ${Date.now().toString(36)}`).

**Alternatives considered**:
- *Borrar por UI* — rechazado para el cliente: el dashboard no expone un delete de cliente desde el viaje, y hacerlo por UI agregaría flujo no cubierto por el spec.
- *Dejar el viaje en borrador (comportamiento actual)* — rechazado: el viaje y el cliente se acumulan; el issue apunta a `create-trip` como fuente de residuos.

**Rationale**: El `afterAll` es el punto más simple y determinista; combina con el sufijo único existente sin agregar dependencias de UI.

### Decision: `globalSetup` de warmup acotado al `webServer` local (D6)

**Choice**: Nuevo `e2e/global-setup.ts` exportado como `globalSetup` en `playwright.config.ts`. Cuando el `webServer` local está activo (`!process.env.BASE_URL`), hace GET a `/login`, `/dashboard` y a una ruta pública de viajero del seed (`/t/${SEED.tripSlug}`); si `BASE_URL` está definido (proyecto preview), se salta. Cada request tiene timeout acotado y el fallo no es fatal (el `webServer` ya esperó a que `url` respondiera).

**Alternatives considered**:
- *Warmup en un `beforeAll` del proyecto local* — rechazado: `beforeAll` por archivo repetiría el warmup por cada spec y no correría antes del primer test.
- *Ignorar el cold-compile* — rechazado: es un riesgo de timeout real en CI con `npm run dev` (compilación on-demand por ruta).
- *Warmup siempre, también contra `BASE_URL`* — rechazado: golpearía el deployment de preview y duplicaría responsabilidad del job `e2e-preview`.

**Rationale**: `globalSetup` corre una vez, después de que Playwright levanta el `webServer` y espera su `url`, y antes del primer test. Es el único punto que da la semántica "una sola vez, con el server ya arriba".

### Decision: Mantener `retries: 2` (D7)

**Choice**: No cambiar `retries: 2` en CI. Agregar un comentario en `playwright.config.ts` que explica que los specs son idempotentes desde el issue #406 y que por eso el retry es seguro.

**Alternatives considered**:
- *`retries: 0` para que CI sea determinista* — rechazado: elimina la red de seguridad ante flakes de red/dev-server genuinos y no ataca la causa raíz (estado sucio), que igual afectaría corridas repetidas.
- *`retries: 1`* — rechazado: reduce la tolerancia sin ganar nada una vez que los reintentos son seguros.

**Rationale**: Con D1–D4 el retry arranca limpio, así que la tolerancia de 2 intentos vuelve a ser lo que debe ser: una red para flake genuino, no un amplificador de estado sucio.

## Data Flow

### Ciclo por spec (con reintentos)

```
beforeEach ──► borra residuos del spec (por nombre/prefijo, REST)
               └─ restaura estado de seed que el spec posee (p. ej. checklist)

test body ──► crea entidades con uniqueName(...)  [sufijo por corrida]
               └─ usa localizadores acotados al título único del test

afterEach/afterAll ──► borra lo creado (REST)
```

### Reintento

```
intento 1 falla a mitad
   └─ deja, como mucho, datos con sufijo único de esa corrida
intento 2 (Playwright retry)
   └─ beforeEach vuelve a limpiar por nombre/prefijo ──► arranca equivalente al seed
      └─ NO hereda el estado sucio del intento 1  ✔
```

### Warmup

```
playwright start
   └─ webServer: npm run dev  ──► espera http://localhost:3000 (timeout 120s)
      └─ globalSetup (solo si !BASE_URL)
           ├─ GET /login
           ├─ GET /dashboard
           └─ GET /t/{tripSlug}   ──► fuerza compilación on-demand de esas rutas
      └─ primer test  ──► rutas principales ya compiladas
```

### Restauración de `service-documents`

```
seed:  service_checklist_items {Pasaporte, Seguro de viaje, Visado}
       service_uploads {Pasaporte: processed, Seguro de viaje: uploaded}
       ──► "1/3 revisados", "1 pendiente de revisión"

test 1 (o un intento previo):  Marcar como revisado ──► Seguro = reviewed
                               Agregar "Copia de pasaporte" ──► total 4

beforeEach (intento siguiente):
  DELETE service_checklist_items?label=eq.Copia de pasaporte   (cascade → upload)
  PATCH  service_uploads?checklist_item_id=eq.{seed seguro}    {status: uploaded}
       ──► "1/3 revisados", "1 pendiente de revisión"  ✔
```

## File Changes

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `e2e/local/helpers.ts` | Modificar | `LOCAL_SUPABASE_SERVICE_ROLE_KEY`, `uniqueSuffix()`, `uniqueName(base)`, `deleteRowsByEq()`, `deleteRowsByNameLike()`, `patchRowsByEq()`. `findSupplierIdByName` no se toca (salvo reuso del cliente REST). |
| `e2e/local/supplier-item-compatibility.spec.ts` | Modificar | `beforeEach` borra `suppliers.name like 'Same Session Tour Operator%'`; proveedor creado con `uniqueName(...)`; `afterAll` borra el proveedor creado; la aserción `toHaveCount(2)` se acota al catálogo base (excluyendo el residuo del propio spec) sin perder la cobertura de "solo proveedores activos compatibles". |
| `e2e/local/traveler-activities.spec.ts` | Modificar | Títulos con sufijo único; localizadores acotados por título (sin `nth`/`.last()`); `beforeEach` borra `trip_items.title like 'E2E %'` del día del seed; `afterAll` borra las actividades creadas. |
| `e2e/local/service-documents.spec.ts` | Modificar | `beforeEach` restaura checklist (D4); aserciones `1/3`, `1 pendiente`, `2/3`, `2/4` intactas. |
| `e2e/local/create-trip.spec.ts` | Modificar | `afterAll` borra el viaje (por id) y el cliente (por email `e2e-new-client@example.com` + sufijo) vía REST. |
| `e2e/global-setup.ts` | Crear | Warmup HTTP (D6). |
| `playwright.config.ts` | Modificar | `globalSetup: "./e2e/global-setup.ts"` + comentario en `retries` referenciando el issue #406. |
| `architecture.md` | Modificar | Sección e2e local (~365-368): specs idempotentes, `db:reset` ya no requerido entre corridas, warmup del `webServer`, nota de stream-abort benigno. |
| `README.md` | Verificar | Fila "Tests" → confirmar que no requiere cambio (lo técnico vive en `architecture.md`). |

## Interfaces / Contracts

### `e2e/local/helpers.ts` (adiciones)

```ts
/** Clave service-role del stack local (ya inyectada por el env del webServer). */
export const LOCAL_SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "<service_role local demo>";

/** Sufijo único por corrida, corto y seguro para nombres visibles. */
export function uniqueSuffix(): string;          // Date.now().toString(36)
export function uniqueName(base: string): string; // `${base} ${uniqueSuffix()}`

/** DELETE /rest/v1/{table}?{col}=eq.{value} con service-role. Devuelve filas afectadas. */
export async function deleteRowsByEq(
  request: APIRequestContext,
  table: string,
  column: string,
  value: string,
): Promise<number>;

/** DELETE por patrón LIKE (p. ej. name=like.Same Session Tour Operator%). */
export async function deleteRowsByNameLike(
  request: APIRequestContext,
  table: string,
  column: string,
  pattern: string,
): Promise<number>;

/** PATCH /rest/v1/{table}?{col}=eq.{value} con body JSON. */
export async function patchRowsByEq(
  request: APIRequestContext,
  table: string,
  column: string,
  value: string,
  body: Record<string, unknown>,
): Promise<number>;
```

### Uso por spec (contrato observable)

| Spec | `beforeEach` limpia | Nombres | `afterAll` borra |
|------|--------------------|---------|------------------|
| `supplier-item-compatibility` | `suppliers.name like 'Same Session Tour Operator%'` | `uniqueName("Same Session Tour Operator")` | proveedor creado (por id) |
| `traveler-activities` | `trip_items.title like 'E2E %'` del `trip_day_id` del seed | `uniqueName("E2E paseo por Trastevere")`, `uniqueName("E2E actividad de Ana")` | actividades creadas (por título) |
| `service-documents` | `service_checklist_items.label = 'Copia de pasaporte'`; `service_uploads` de `Seguro de viaje` → `uploaded` | n/a | n/a (se restaura, no se crea) |
| `create-trip` | n/a (título ya único) | `E2E Roadtrip ${uniqueSuffix()}` | viaje por id + cliente por email |

### `e2e/global-setup.ts`

```ts
import { request } from "@playwright/test";

export default async function globalSetup(): Promise<void> {
  if (process.env.BASE_URL) return; // preview: el warmup no aplica
  const base = "http://localhost:3000";
  const ctx = await request.newContext({ baseURL: base, timeout: 30_000 });
  for (const path of ["/login", "/dashboard", "/t/italia-perez-2026"]) {
    try {
      await ctx.get(path);
    } catch {
      // El webServer ya validó su url; un fallo de warmup no debe abortar la suite.
    }
  }
  await ctx.dispose();
}
```

## Testing Strategy

No hay tests unitarios nuevos: el cambio es del arnés e2e. `strict_tdd` se aplica como ciclo observado sobre la propia suite.

| Paso | Qué se corre | Resultado esperado |
|------|--------------|--------------------|
| RED (repro) | `npm run test:e2e -- --project=local` **dos veces sin `db:reset`** sobre la base con residuos de una corrida previa | Reproduce el fallo de los specs del issue (conteo `1/3`, `toHaveCount(2)`, strict-mode `input[name=title]`) |
| GREEN | El mismo comando dos veces seguidas, ya con D1–D7 aplicados | Ambas corridas verdes, sin reset intermedio |
| TRIANGULATE | Borrar a mano un residuo y forzar un reintento (`--retries=1` con un fallo inducido temporalmente en un spec) | El intento 2 arranca limpio y pasa |
| REFACTOR | Revisar que los helpers REST sean genéricos y que los specs no dupliquen lógica de limpieza | Sin cambios de comportamiento; suite sigue verde |

| Capa | Qué se verifica | Enfoque |
|------|-----------------|---------|
| Idempotencia | Repetir la suite 2 veces sin reset | Comando de verificación (WU8) |
| Reintento limpio | `beforeEach` corre por intento | Inspección + corrida con retry inducido |
| Sin residuos | Conteos de filas antes/después (REST) | Los propios `beforeEach`/`afterAll` |
| Warmup | Rutas compiladas antes del primer test | Log del `webServer` sin `Compiled /login` durante el primer test |
| No regresión de producto | Mismas aserciones de producto | Diff: ningún `expect` de comportamiento cambia |
| Type/lint | `npx tsc --noEmit`, `npm run lint` | Comandos del config |

## Threat Matrix

N/A — este cambio no introduce routing de shell/CLI, comandos, subprocesos, automatización de VCS/PR, clasificación de ejecutables ni un borde de integración de procesos. `e2e/global-setup.ts` es un archivo de harness de Playwright que hace GETs HTTP a una base local fija (o se salta con `BASE_URL`); no es una superficie de routing adversarial. Ninguna fila de la matriz aplica y no se fabrican tests RED desde ella.

## Migration / Rollout

- **Datos/esquema**: sin migraciones. El cambio no toca `supabase/migrations/` ni `supabase/seed.sql`.
- **Rollout**: es un cambio de CI/harness. Se puede mergear en un PR; el efecto se observa en la próxima corrida de `e2e-local`.
- **Compatibilidad**: los specs siguen usando el stack local existente y las claves demo ya inyectadas. El `globalSetup` se salta cuando `BASE_URL` está definido, así que el proyecto `preview` y el job `e2e-preview` quedan intactos.
- **Rollback**: revert de commits (specs/helpers/globalSetup/config/docs). `findSupplierIdByName`, `loginAs*`, `signInClient`, `ensureTripStatus` y demás helpers existentes no cambian de contrato.
- **Docs**: `architecture.md` es la fuente de verdad técnica; su actualización entra en el mismo cambio.

## Open Questions

- [ ] ¿Conviene un `beforeEach` global (proyecto local) que limpie por prefijo `E2E %` en todas las tablas, en lugar de limpieza por spec? Se opta por limpieza por spec para que cada spec sea dueño explícito de sus datos y el diff sea revisable; se reevalúa si aparecen residuos de otros specs.
- [ ] ¿El warmup debe incluir también una ruta autenticada de detalle de viaje (`/dashboard/trips/{id}`)? Se deja fuera en la primera versión para mantener el `globalSetup` sin estado de auth; se mide el tiempo del job y se decide con evidencia.
- [ ] ¿`service-documents` debería borrar también filas de `services` residuales (si las hubiera)? Hoy el seed las crea de forma determinista y el spec no crea servicios; se documenta como no-go hasta ver evidencia.
