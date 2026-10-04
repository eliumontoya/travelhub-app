# security: revisar 13 vulnerabilidades reportadas por npm audit

Issue: eliumontoya/travelhub-app#395
Branch: eliumontoya/security-revisar-13-vulnerabilidades-reportadas

## Objetivo

Cerrar las 13 vulnerabilidades (1 crítica, 8 altas, 4 moderadas) reportadas por
`npm audit`, dejando el check `audit` del dashboard de sanidad en `pass`.

## Decisiones del usuario

- `xlsx` (sin fix en npm): instalar SheetJS vendored desde el CDN oficial
  (https://cdn.sheetjs.com), misma API, sin refactor de los consumidores.
- `undici` vía `eve`: actualizar `eve` a 0.71.0 (undici 8.10.2, parchado).
  Requiere Node >= 24 (local v26 OK; verificar runtime de Vercel).

## Estado inicial (verificado)

- `next` 16.3.4 → fix crítico RCE next/og en 16.3.8 (bump no mayor).
- `xlsx` 0.18.5: prototype pollution + ReDoS (GHSA-vfj7-8cjw-p6xm). Consumidores:
  `src/app/api/wcc/knowledge/export/route.ts`, `src/app/api/wcc/knowledge/import/route.ts`,
  `scripts/export-knowledge-to-excel.mjs`.
- `undici` 8.9.0 anidado en `node_modules/eve/node_modules` (11 advisories).
  Primera versión de eve con undici 8.10.2 (parchado): 0.69.0.
- Cadena dev: `eslint-config-next` 16.3.4 → `@next/eslint-plugin-next` →
  `fast-glob` → `micromatch` → `braces`; más `brace-expansion` directo.
  npm propone downgrade a 14.2.35 — se descarta; se usan `overrides`.
- Moderadas: `vitest`, `@vitest/mocker`, `@vitest/coverage-v8`, `eve` (se cierra con el bump).

## Tareas

- [x] 1. Bump `next` 16.3.4 → 16.3.8 y `eslint-config-next` 16.3.8. Commit `3a40acd`.
      Crítica (RCE next/og) cerrada; tsc limpio; build verificado al final.
- [x] 2. `xlsx` → SheetJS 0.20.3 vendored desde CDN oficial. Commit `85a574f`.
      21 tests de knowledge/wcc en verde; smoke de API (write/read/sheet_to_json) OK.
      Nota: el issue atribuía GHSA-vfj7-8cjw-p6xm a xlsx; en realidad es de `braces`.
- [x] 3. `eve` 0.54.3 → 0.71.0 (undici anidado 8.10.2, parchado). Commit `7aa4bdb`.
      tsc limpio; 36 tests de AI/agente en verde. Vercel: Node 24.x es default/GA,
      compatible con engines >=24 de eve (confirmar setting del proyecto).
- [x] 4. `overrides`: brace-expansion 1.1.21; vitest/@vitest/* → 4.1.11. Commit `86b3592`.
- [x] 5. Verificación final: audit 0 críticas/0 altas/0 moderadas no aceptadas;
      sanity Dependencies **pass 100** (5 aceptadas documentadas); suite 804/804;
      build OK; lint 0 errores (10 warnings preexistentes); e2e 30/30 (dos corridas
      completas consecutivas). Dead code: 61 issues preexistentes (base: equivalentes).
- [x] 6. Política de riesgo documentado: feature `checks.auditAllow` en sanity-kit
      (repo aparte, cambios sin commitear — pendiente de decisión del usuario) +
      `sanity.config.mts` con `braces` aceptado (commit `a1c6331`).

## Revisión nativa (RDD)

- Lineage `review-ce4f8c077a0fde28`, lente review-reliability: **approved**,
  autoridad quemada (`gentle-ai.review-acknowledged/v1`).
- 5 hallazgos informativos no bloqueantes (seguimiento futuro, no reabren la revisión):
  auditAllow sin versión anclada (SUGGESTION); tarball CDN de xlsx sin lock de
  integridad típica de registry (WARNING); salto mayor de eve (SUGGESTION);
  override de brace-expansion es downgrade de mayor (WARNING); versión de override
  existente en registry (SUGGESTION).

## Pendientes del usuario

- Push de la branch / PR (decisión de delivery ordinaria).
- Commit de los cambios de sanity-kit (repo master, con README previamente
  modificado sin commitear).
- Comentario/cierre del issue #395.

## Criterio de aceptación (del issue)

- `npm audit` sin critical/high en dependencias de runtime (o riesgo documentado).
- `npm run sanity` con check Dependencies en ✅ (score 100).
- Suite completo en verde (`npm run test`, e2e mock).

## Evidencia

(registrar commits por tarea)
