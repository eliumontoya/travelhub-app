# Proposal: E2E Local estable en CI

**Change slug:** `e2e-local-estable-ci`
**Issue:** [#406 — E2E Local job flaky en main](https://github.com/eliumontoya/travelhub-app/issues/406)
**Fase:** propose
**Estado:** listo para spec + design

## Intent

El job `e2e-local` de CI falla de forma sistemática sobre `main`. Siempre los mismos tres specs: `traveler-activities.spec.ts`, `service-documents.spec.ts` y `supplier-item-compatibility.spec.ts`. La evidencia aportada en el issue son dos corridas de CI:

- `37240418947` — base del PR #405.
- `37255713862` — posterior al merge (`main`).

El problema **no** es de producto ni de cobertura: la suite verifica comportamiento real y algunos de esos flujos ya pasan de forma intermitente. El problema es de **manejo de estado entre corridas y entre reintentos**, más un riesgo de compilación on-demand del `npm run dev`. Mientras siga así, `main` queda con un job rojo permanente y el equipo pierde la señal de CI.

### Causas raíz (evidencia)

1. **Specs que crean datos sin limpiar.** Los tres specs mutan datos persistidos en el stack de Supabase local y no los restauran:
   - `supplier-item-compatibility.spec.ts` crea el proveedor `Same Session Tour Operator` en cada corrida y lo deja vivo.
   - `traveler-activities.spec.ts` crea actividades (`E2E paseo por Trastevere`, `E2E actividad de Ana`); la tercera prueba nunca borra la suya.
   - `service-documents.spec.ts` marca `Seguro de viaje` como revisado y agrega el documento solicitado `Copia de pasaporte`, dejando la checklist en `2/4` en lugar del `1/3` del seed.
   - `create-trip.spec.ts` crea un viaje y un cliente nuevos; revierte el viaje a borrador pero no los elimina.
2. **`retries: 2` solo en CI** (`playwright.config.ts:41`) hace que el intento 2 herede el estado sucio del intento 1. El caso reportado es una violación de strict mode: `locator('input[name=title]') resolved to 2 elements`. El mecanismo es concreto: en `traveler-activities.spec.ts` el helper `expandActivityForm` usa `day.locator("input[name=title]")`, y una actividad residual en ese mismo día ya aporta su propio `details input[name=title]` de edición (el spec lo usa más abajo en la variante mobile), así que el localizador pasa a resolver 2 elementos.
3. **Ruido `[WebServer] ⨯ Error: The destination stream closed early`.** El dev-server aborta el streaming cuando un test cierra o navega una página en medio de una respuesta. El servidor sobrevive (el log muestra 32 tests pasando alrededor del error), pero el compilado on-demand de `npm run dev` en CI sigue siendo un riesgo real de timeout/flake en el primer hit de cada ruta.

## Scope

### In Scope

- Idempotencia de estado en los specs que mutan datos: `supplier-item-compatibility.spec.ts`, `traveler-activities.spec.ts`, `service-documents.spec.ts` y `create-trip.spec.ts`.
- Helper compartido en `e2e/local/helpers.ts`: sufijo único por corrida + helpers REST de borrado (patrón service-role ya inyectado por el `env` del `webServer`).
- Localizadores no posicionales en los tres specs frágiles (reemplazo de `.nth(2)` / `.last()` por localizadores acotados por título propio del spec).
- Restauración del estado de checklist de `service-documents.spec.ts` (borrar `Copia de pasaporte` residual y volver `Seguro de viaje` a `uploaded`) antes de cada intento.
- Limpieza de viaje + cliente creados en `create-trip.spec.ts` (`afterAll` vía REST).
- `globalSetup` de Playwright (`e2e/global-setup.ts`) que pre-calentó las rutas principales una vez levantado el `webServer`.
- Comentario en `playwright.config.ts` que documenta por qué `retries: 2` se mantiene (issue #406).
- Actualización del `architecture.md` (sección e2e local) y verificación de la fila correspondiente en la tabla de fuente de verdad de `README.md`.

### Out of Scope

- Cambiar qué verifica cada spec. La cobertura de comportamiento de producto queda intacta (mismos flujos, mismas aserciones de producto); solo cambian manejo de estado, localizadores y setup/teardown.
- Reducir `retries` a 0, o activar `retries` en local. Decisión explícita: se mantiene `retries: 2` en CI (D7).
- Migrar la suite a un stack efímero por corrida, contenedores por spec o aislamiento por base de datos.
- Suprimir el log `destination stream closed early` desde el código de la app o silenciar la salida del `webServer`.
- Cambiar el `workers: 1` del proyecto `local` o habilitar paralelismo.
- Cambiar el proyecto `preview` o el job `e2e-preview`.

## Capabilities

> Esta sección es el CONTRATO entre proposal y specs.

### New Capabilities

- `e2e-local-stability`: la suite `e2e/local` es idempotente y repetible contra una base con datos residuales, los reintentos arrancan desde un estado equivalente al seed para los datos que cada spec posee, las entidades creadas usan nombres únicos por corrida y se eliminan al final, y el `webServer` de CI pre-calienta rutas antes del primer test. Cubre `e2e/local/helpers.ts`, los cuatro specs nombrados, `e2e/global-setup.ts`, `playwright.config.ts` y la sección e2e de `architecture.md`.

### Modified Capabilities

- Ninguna. Este cambio no altera el contrato de producto de ningún dominio; solo estabiliza el arnés de pruebas.

## Approach

1. **Limpiar-antes-de-actuar (D1).** Cada spec que muta estado restaura en `beforeEach` el estado de seed de los datos que posee. Como `beforeEach` corre en cada intento, los reintentos nunca heredan suciedad. Además limpia al final (`afterEach`/`afterAll`). Se prefieren ambas cosas: borrar por nombre conocido al inicio (cinturón) y borrar al final (tirantes).
2. **Nombres únicos por corrida (D2).** Las entidades nuevas llevan un sufijo único generado por un helper (p. ej. `-${Date.now().toString(36)}`), de modo que corridas repetidas o paralelas no colisionan con datos residuales.
3. **Localizadores no posicionales (D3).** Se eliminan `getByText(...).nth(2)` y `.last()` de los specs frágiles; se reemplazan por localizadores acotados por el título único del propio spec, de modo que una fila residual nunca cambie a qué elemento se hace click.
4. **Restauración de estado de documentos (D4).** Al inicio del spec se borra el documento solicitado residual `Copia de pasaporte` y se devuelve `Seguro de viaje` a `uploaded`, para que las aserciones iniciales `1/3 revisados` / `1 pendiente de revisión` se sostengan en re-corridas.
5. **Higiene de create-trip (D5).** Se eliminan el viaje y el cliente creados al final del spec (`afterAll`, REST), manteniendo la tolerancia a nombres únicos que ya existe.
6. **Estabilidad del `webServer` (D6).** Un `globalSetup` de Playwright hace GETs HTTP simples a las rutas principales (login, dashboard y una ruta pública de viajero del seed) una vez que el `webServer` responde, de modo que la compilación on-demand ocurre antes del primer test. Se documenta en `architecture.md` que `destination stream closed early` es ruido benigno de abort, salvo que el servidor deje de responder.
7. **No tocar `retries` (D7).** Con D1–D4 los reintentos se vuelven seguros; se mantiene `retries: 2` y se agrega un comentario que referencia el issue #406.

## Affected Areas

| Área | Impacto | Descripción |
|------|---------|-------------|
| `e2e/local/helpers.ts` | Modificado | Nuevo helper de sufijo único por corrida y helpers REST de borrado por tabla + por nombre (service-role), siguiendo el patrón de `findSupplierIdByName`. |
| `e2e/local/supplier-item-compatibility.spec.ts` | Modificado | Nombre de proveedor único; `beforeEach` borra residuos `Same Session Tour Operator*`; `afterAll` borra el creado; aserción de conteo de opciones acotada para excluir residuales sin perder cobertura. |
| `e2e/local/traveler-activities.spec.ts` | Modificado | Títulos de actividad únicos; localizadores acotados por título (sin `nth`/`.last()`); `beforeEach` borra actividades residuales con los prefijos del spec; borrado de lo creado al final. |
| `e2e/local/service-documents.spec.ts` | Modificado | `beforeEach` restaura el estado de checklist (borra doc solicitado residual, devuelve `Seguro de viaje` a `uploaded`); aserciones intactas. |
| `e2e/local/create-trip.spec.ts` | Modificado | `afterAll` elimina viaje + cliente creados vía REST. |
| `e2e/global-setup.ts` | Nuevo | Pre-calentamiento HTTP de rutas principales una vez arriba el `webServer`. |
| `playwright.config.ts` | Modificado | Wiring de `globalSetup` + comentario sobre `retries: 2` (issue #406). |
| `architecture.md` | Modificado | Sección e2e local: specs idempotentes, `db:reset` ya no requerido entre corridas, warmup del `webServer` y nota del stream-abort benigno. |
| `README.md` | Verificado | La tabla de fuente de verdad apunta a `architecture.md` para lo técnico; confirmar que no requiere edición. |

## Risks

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Los helpers REST de borrado borran datos más de lo previsto | Media | Acotar estrictamente por nombre/prefijo del propio spec; nunca borrar por tabla completa; revisar cada delete en el diff. |
| El borrado con service-role enmascara un fallo real (el spec "pasa" porque limpió, no porque el producto funcione) | Media | No se tocan las aserciones de producto; los tests siguen fallando si el flujo real se rompe. La limpieza es arranque/final, no verificación. |
| Un `globalSetup` con `BASE_URL` (proyecto preview) golpea el deployment equivocado | Media | El warmup corre solo cuando el `webServer` local está activo; si `BASE_URL` está definido, se salta (registrado como decisión en design). |
| Nombres únicos por corrida vuelven inestables las aserciones de conteo | Media | Las aserciones se acotan al nombre propio del spec; no se asume un total absoluto global. |
| El warmup agrega tiempo al job sin eliminar del todo el cold-compile | Baja | Rutas mínimas y timeout acotado; el warmup complementa, no reemplaza, la tolerancia de timeout del `webServer`. |
| La suite sigue dejando residuos por specs no incluidos en este cambio | Media | Fuera de alcance explícito; el criterio de cierre verifica los tres specs del issue y `create-trip`. Se documenta como follow-up si aparece. |

## Rollback Plan

- **Specs y helpers**: revert de los commits de este cambio. Cada spec vuelve a su versión previa y `helpers.ts` recupera su API anterior; `findSupplierIdByName` no se modifica.
- **`globalSetup`**: quitar la clave `globalSetup` de `playwright.config.ts` y eliminar `e2e/global-setup.ts`. El `webServer` sigue funcionando exactamente como hoy.
- **`playwright.config.ts`**: revert del comentario y del wiring; `retries: 2` nunca cambia.
- **Docs**: revert de la sección e2e de `architecture.md`. Los documentos son la única fuente de verdad del tema; el revert restaura el texto previo (que exige `db:reset`).

Sin migraciones, sin cambios de esquema, sin cambios de código de producto: el rollback es un revert de bajo riesgo.

## Dependencies

- Stack de Supabase local ya usado por el proyecto `local` (`supabase start` + `supabase db reset`), y las claves demo locales ya inyectadas por el `env` del `webServer`.
- Playwright `^1.62.0` (soporta `globalSetup`).
- La fila de tests de la tabla de fuente de verdad en `README.md`, que apunta a `architecture.md` para lo técnico.

## Success Criteria

- [ ] Los tres specs del issue (`traveler-activities`, `service-documents`, `supplier-item-compatibility`) más `create-trip` pasan dos veces seguidas sin `npm run db:reset` entre corridas.
- [ ] Un reintento de un spec fallido arranca desde un estado equivalente al seed para los datos que ese spec posee.
- [ ] Ningún spec deja entidades creadas por él (proveedor, actividad, documento solicitado, viaje, cliente) en la base.
- [ ] El `webServer` local pre-calienta login, dashboard y una ruta pública de viajero antes del primer test.
- [ ] `npx tsc --noEmit` y `npm run lint` pasan limpios.
- [ ] El job `e2e-local` de CI queda verde en `main`.
- [ ] No cambia ninguna aserción de comportamiento de producto.
