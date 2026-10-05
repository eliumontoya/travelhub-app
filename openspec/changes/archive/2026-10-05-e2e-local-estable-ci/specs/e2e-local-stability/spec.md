# E2E Local Stability Specification

## Purpose

Hacer que la suite Playwright del proyecto `local` (`e2e/local`) sea **idempotente y repetible**: cada corrida y cada reintento deben partir de un estado equivalente al seed para los datos que cada spec posee, sin requerir `npm run db:reset` entre corridas. El objetivo es que el job `e2e-local` de CI sobre `main` deje de fallar de forma sistemática (issue #406) por acumulación de datos residuales, localizadores posicionales y compilación on-demand del dev-server, **sin** cambiar qué comportamiento de producto verifican los tests.

Alcance: `e2e/local/helpers.ts`, `e2e/local/supplier-item-compatibility.spec.ts`, `e2e/local/traveler-activities.spec.ts`, `e2e/local/service-documents.spec.ts`, `e2e/local/create-trip.spec.ts`, `e2e/global-setup.ts`, `playwright.config.ts` y la sección e2e de `architecture.md`.

## Requirements

### Requirement: Idempotencia de la suite ante datos residuales

Cada spec que muta datos persistentes MUST restaurar el estado de seed de los datos que posee antes de ejecutar su cuerpo, de modo que la suite completa pueda correr repetidamente contra una base con datos residuales de corridas previas sin requerir un reset de base. Al finalizar, cada spec SHOULD eliminar las entidades que creó, como defensa adicional (cinturón y tirantes).

#### Scenario: Suite repetida sin reset

- GIVEN una base con datos residuales dejados por una corrida previa de la suite `e2e/local`
- WHEN el usuario ejecuta `npm run test:e2e -- --project=local` sin ejecutar `npm run db:reset`
- THEN los specs `traveler-activities`, `service-documents`, `supplier-item-compatibility` y `create-trip` MUST pasar
- AND la suite completa MUST pasar sin restaurar la base manualmente.

#### Scenario: Estado de checklist restaurado

- GIVEN un intento previo que dejó el documento solicitado `Copia de pasaporte` y `Seguro de viaje` en estado revisado
- WHEN `service-documents.spec.ts` arranca
- THEN el sistema de prueba MUST eliminar el documento solicitado residual `Copia de pasaporte`
- AND MUST devolver `Seguro de viaje` al estado `uploaded`
- AND las aserciones iniciales `1/3 revisados` y `1 pendiente de revisión` MUST sostenerse.

#### Scenario: Ningún spec deja entidades propias

- GIVEN la suite ejecutada hasta el final
- WHEN la corrida termina
- THEN el proveedor creado por `supplier-item-compatibility.spec.ts`, las actividades creadas por `traveler-activities.spec.ts` y el viaje y cliente creados por `create-trip.spec.ts` MUST haber sido eliminados.

### Requirement: Reintentos desde un estado equivalente al seed

Cuando un intento de un spec falla y Playwright reintenta, el nuevo intento MUST arrancar desde un estado equivalente al seed para los datos que ese spec posee. El reintento MUST NOT heredar el estado sucio del intento fallido.

#### Scenario: Retry tras fallo de un spec que muta estado

- GIVEN un spec que muta estado y falla en su intento 1 dejando datos creados
- WHEN Playwright ejecuta el intento 2 (retry)
- THEN el intento 2 MUST ejecutar la restauración de estado previa al cuerpo del test
- AND el intento 2 MUST partir de un estado equivalente al seed para los datos del spec
- AND el intento 2 MUST NOT fallar a causa de los datos dejados por el intento 1.

#### Scenario: Sin violación de strict mode por residuos

- GIVEN un día del seed que ya contiene una actividad residual creada por un intento previo
- WHEN un test expande el formulario de alta de actividad y completa su campo `title`
- THEN el localizador del campo `title` MUST resolver a un único elemento
- AND la ejecución MUST NOT fallar con `strict mode violation: locator('input[name=title]') resolved to 2 elements`.

### Requirement: Nombres únicos por corrida y limpieza de entidades creadas

Toda entidad creada por un spec con impacto persistente MUST usar un nombre con sufijo único por corrida, de modo que corridas repetidas o reintentos no colisionen con datos residuales. El spec MUST eliminar las entidades que creó al finalizar.

#### Scenario: Nombres únicos por corrida

- GIVEN dos corridas consecutivas de la suite sin reset
- WHEN cada corrida crea un proveedor, una actividad o un viaje
- THEN cada entidad creada MUST llevar un sufijo único generado en esa corrida
- AND los nombres de corridas distintas MUST NOT colisionar.

#### Scenario: Aserciones de conteo acotadas al dato propio

- GIVEN un catálogo de proveedores compatibles con al menos un proveedor residual que coincide con el nombre del spec
- WHEN `supplier-item-compatibility.spec.ts` verifica el catálogo de proveedores compatibles
- THEN la aserción MUST evaluar solo el catálogo base acotado por el spec
- AND MUST NOT fallar por el proveedor residual.

#### Scenario: Selección por título propio, no por posición

- GIVEN una lista con filas residuales de corridas previas que preceden a la fila creada por el test
- WHEN el test selecciona, edita o elimina la actividad creada en esa corrida
- THEN el localizador MUST acotarse por el título único de esa actividad
- AND MUST NOT depender de `nth` ni de `.last()` sobre la lista completa.

### Requirement: Pre-calentamiento de rutas del webServer

Cuando el `webServer` local de Playwright está activo, el sistema de prueba MUST pre-calentar las rutas principales antes de que corra el primer test, de modo que la compilación on-demand del dev-server no ocurra dentro de la ventana de timeout de un test. El pre-calentamiento MUST acotarse al `webServer` local y MUST NOT ejecutarse contra un target remoto (`BASE_URL`).

#### Scenario: Rutas principales compiladas antes del primer test

- GIVEN el `webServer` local levantado por Playwright
- WHEN la suite arranca
- THEN el sistema de prueba MUST hacer HTTP GET a `/login`, `/dashboard` y una ruta pública de viajero del seed
- AND esas rutas MUST quedar compiladas antes de que corra el primer test.

#### Scenario: Fallo de warmup no aborta la suite

- GIVEN el `webServer` local ya respondió en su `url`
- WHEN un GET de pre-calentamiento falla o expira
- THEN la suite MUST continuar ejecutándose
- AND el fallo del warmup MUST NOT ser por sí mismo motivo de fallo de la corrida.

#### Scenario: Preview sin warmup local

- GIVEN que la variable `BASE_URL` está definida (target remoto)
- WHEN la suite arranca
- THEN el pre-calentamiento local MUST NOT ejecutarse
- AND el proyecto `preview` MUST conservar su comportamiento actual.

#### Scenario: Ruido de streaming documentado como benigno

- GIVEN que el dev-server registra `[WebServer] ⨯ Error: The destination stream closed early` mientras la suite corre
- WHEN el servidor sigue respondiendo y los tests avanzan
- THEN la corrida MUST NOT fallar únicamente por esa línea de log
- AND `architecture.md` MUST documentar que ese mensaje es ruido benigno de abort de streaming, salvo que el servidor deje de responder.

### Requirement: Cobertura de comportamiento de producto sin cambios

Este cambio MUST limitarse a manejo de estado, localizadores y setup/teardown. Las aserciones que verifican comportamiento de producto MUST conservar su cobertura y su intención.

#### Scenario: Aserciones de producto intactas

- GIVEN el diff de este cambio
- WHEN se revisan los archivos de los cuatro specs
- THEN ninguna aserción de comportamiento de producto (`expect` sobre flujos, textos, estados o visibilidad de la app) MUST haber sido eliminada o debilitada
- AND los únicos cambios en los specs MUST ser de restauración de estado, nombres únicos, localizadores y teardown.

#### Scenario: Fallo real de producto sigue fallando

- GIVEN un defecto real en un flujo cubierto por los specs del issue
- WHEN la suite corre
- THEN el spec correspondiente MUST seguir fallando
- AND la limpieza de estado MUST NOT enmascarar el fallo.

#### Scenario: Configuración de retries sin cambios

- GIVEN `playwright.config.ts`
- WHEN se revisa la configuración de reintentos
- THEN `retries: process.env.CI ? 2 : 0` MUST permanecer sin cambios de valor
- AND el archivo MUST incluir un comentario que explique que los specs son idempotentes desde el issue #406 y que por eso el reintento es seguro.
