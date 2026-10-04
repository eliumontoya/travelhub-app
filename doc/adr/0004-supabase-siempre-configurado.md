# ADR 0004 — Eliminación del modo mock in-memory en favor de Supabase siempre configurado

- **Estado**: accepted

## Fecha

2026-10-03 (issue #372; PRs #388–#393)

## Contexto

La app mantenía una capa de datos "dual": usaba Supabase cuando estaba
configurado y `mock-data` en memoria cuando no. Ese modo alternativo duplicaba
la lógica, escondía diferencias de comportamiento respecto de Supabase y
permitía correr la app sin la base real, lo que volvía ambiguo qué era fuente
de verdad del modelo de datos.

Nota de contradicción documental: al 2026-10-04 `architecture.md` afirma que el
modo en memoria ya no existe y que `mock-data` fue eliminado en #372
(sección "Capa de datos" y "Frontera de acceso a datos"), pero `README.md`
(sección "Arquitectura") todavía dice que la capa "soporta modo dual: Supabase
cuando esta configurado, mock data en memoria cuando no", y `PRODUCT.md`
(Capabilities and Constraints) todavía menciona "an in-memory mock mode keeps
the core application runnable without a Supabase account". Según la tabla de
fuentes de verdad del `README.md`, la fuente técnica es `architecture.md`, así
que esta ADR registra el estado real (sin mock) y deja anotado que esos dos
pasajes quedaron desactualizados.

## Decisión

Eliminar el modo mock in-memory y dejar Supabase como requisito único de la
capa de datos. `src/lib/data/*` (y la familia WCC `src/lib/wcc-*.ts`) leen y
escriben exclusivamente contra Supabase; para desarrollo local se usa el stack
de Supabase CLI (`npm run db:start` / `npm run db:reset`).

## Consecuencias

- Se gana una sola fuente de verdad del modelo de datos y se elimina lógica
  duplicada de mock.
- Se acepta que la app requiere Supabase para funcionar: no hay modo degradado
  sin base, y el entorno local depende de Docker + Supabase CLI.
- Queda pendiente actualizar los pasajes stale de `README.md` y `PRODUCT.md`
  (fuera del alcance de este cambio, que no reescribe contenido).
- Referencias: `architecture.md` (Capa de datos → "ya no tiene modo en
  memoria"; Frontera de acceso a datos → `mock-data` eliminado en #372),
  issue #372.
