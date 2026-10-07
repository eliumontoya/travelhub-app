# ci-e2e: e2e-local contra servidor de producción en CI (issue #409)

## Contexto

El job `E2E Local (Playwright)` en CI es inestable: `playwright.config.ts`
arranca `npm run dev` como webServer y el dev server de Next bajo un runner de
CI frío entrega las server actions tarde o aborta el stream (`destination
stream closed early`), produciendo aserciones que expiran y mutaciones tardías
que compiten con la restauración de los reintentos. Diagnóstico del issue:
la solución es correr CI contra servidor de producción (`next build && next
start`); subir timeouts no elimina la causa.

## Tareas

1. [x] Cambiar `webServer.command` de `playwright.config.ts` a prod server
       cuando `CI`, conservando `dev` en local. Comentarios actualizados.
2. [x] Agregar paso `npm run build` al job `e2e-local` de `.github/workflows/ci.yml`
       con las mismas `NEXT_PUBLIC_*` locales que el paso de tests (se inlinen
       en build time).
3. [x] Actualizar comentarios desactualizados (`e2e/global-setup.ts`) y la
       sección e2e de `architecture.md` (webServer, ruido benigno condicionado
       a dev).
4. [x] Verificación local: suite e2e local completa contra build de
       producción pasa dos veces consecutivas sin `db:reset`
       (35 passed / 1 skipped, ~35s; `service-documents` 2,8s sin esperar
       timeouts). `next-env.d.ts` alterna con el último comando de Next y se
       dejó fuera del commit. Lint/typecheck sin cambios (15 warnings
       preexistentes).
5. [x] Commit work-unit: `ccdf64a` — `ci(e2e): run e2e-local against
       production server in CI (issue #409)` (rama
       `eliumontoya/ci-e2e-e2e-local-en-ci-debe-correr-contra-servid`).

## Estado de criterios de aceptación

- [x] e2e-local corre en CI contra servidor de producción; local conserva dev
      (implementado; verificado localmente con `CI=1`).
- [ ] Job verde en 3 corridas consecutivas del mismo commit en CI
      (post-merge, solo observable en GitHub Actions).
- [ ] `destination stream closed early` desaparece de CI o deja de
      correlacionar con fallos: en local con prod sigue apareciendo pero sin
      correlación con fallos (35/35 pasan); a confirmar en CI.
- [ ] Reintentos sin mutaciones tardías heredadas: sin fallos ni reintentos
      en las dos corridas locales; a confirmar en CI.

## Decisiones

- El gate de entorno es `process.env.CI` (mismo patrón que `forbidOnly`);
  `next build` queda como paso explícito del workflow para tener logs y fallos
  de build atribuibles, y el webServer solo arranca `npm run start`.
- El build se inyecta con las claves demo locales de Supabase (públicas,
  ya commiteadas en el config) para que el bundle cliente apunte al mismo
  stack local que el server bajo test.
