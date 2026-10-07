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
4. [ ] Verificación local: `npm run build` + `next start` contra el stack
       Supabase local y correr la suite e2e local completa.
5. [ ] Commit work-unit en la rama del issue (`test(e2e): ...`).

## Criterios de aceptación (del issue)

- [ ] e2e-local corre en CI contra servidor de producción; local conserva dev.
- [ ] Job verde en 3 corridas consecutivas del mismo commit en CI (post-merge,
      verificable solo en GitHub Actions).
- [ ] `destination stream closed early` desaparece de la corrida de CI (o deja
      de correlacionar con fallos).
- [ ] Reintentos sin mutaciones tardías heredadas (sin carrera action vs
      restauración).

## Decisiones

- El gate de entorno es `process.env.CI` (mismo patrón que `forbidOnly`);
  `next build` queda como paso explícito del workflow para tener logs y fallos
  de build atribuibles, y el webServer solo arranca `npm run start`.
- El build se inyecta con las claves demo locales de Supabase (públicas,
  ya commiteadas en el config) para que el bundle cliente apunte al mismo
  stack local que el server bajo test.
