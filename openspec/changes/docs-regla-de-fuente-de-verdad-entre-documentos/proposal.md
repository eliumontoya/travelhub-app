# Change: Regla de fuente de verdad entre documentos

- **Tipo**: docs (sin cambio de comportamiento)
- **Issue**: [#375](https://github.com/eliumontoya/travelhub-app/issues/375)
- **Modo**: openspec (sin specs de comportamiento — cambio pasivo de documentación)
- **Alcance aprobado por el usuario**: las 4 partes del issue en un solo PR.

## Why

El repo mantiene seis documentos de primer nivel (`project.md`, `architecture.md`, `PRODUCT.md`, `DESIGN.md`, `README.md`, `Changes.md`) más la capa `doc/`, sin una regla explícita de qué documento es fuente de verdad de qué. La auditoría de 2026-10-02 detectó dos incidentes reales: `architecture.md` estuvo semanas desactualizado y `project.md` llevó una contradicción viva sobre el acceso del cliente. Los `AGENTS.md` solo obligan a leer `project.md` y `architecture.md`; los demás docs entran sin regla y pueden desinformar igual.

## What Changes

1. **Parte 1 — Tabla de fuente de verdad** en `README.md` (tema → documento fuente), referenciada desde `AGENTS.md`.
2. **Parte 2 — Desduplicación `project.md` vs `PRODUCT.md`**: lectura en paralelo; los pasajes duplicados se eliminan dejando cross-references según la tabla. Restricción: no reescribir contenido, solo delimitar, desduplicar y enlazar.
3. **Parte 3 — Regla de actualización por PR**: todo PR que cambia comportamiento (no solo implementación) verifica si algún documento de la tabla envejeció, igual que hoy se verifican tests. Regla escrita en `AGENTS.md` (contrato de agentes) y visible para humanos en el PR flow.
4. **Parte 4 — ADRs ligeros**: `doc/adr/` con plantilla mínima (contexto, decisión, consecuencias, fecha) y retro-registro de decisiones estructurales ya tomadas: portal de cliente con email + PIN, multi-cuenta con roles y feature flags, servidor MCP, eliminación del modo mock (#372) y botones ↑/↓ sobre `sort_order` en vez de drag-and-drop.

## Impact

- Affected: `README.md`, `AGENTS.md`, `project.md`, `PRODUCT.md`, nuevo `doc/adr/` (plantilla + 5 ADRs), nuevo registro en `odd/tasks/`.
- NOT affected: código, `architecture.md` (solo lectura para cross-references), `DESIGN.md`, `Changes.md`, supabase/.
- Risks: bajo — documentación pasiva. Rollback: revert del PR.
- Noted follow-up (fuera de alcance por la restricción de no reescribir): `PRODUCT.md` y `README.md` aún mencionan modo mock in-memory eliminado en #372; se reporta al cierre para un issue posterior.

## Capabilities

- `doc-governance` (documentación): el repo define y aplica una regla de fuente de verdad documental observable por cualquier lector (humano o agente).

## Decision needed before apply: No
