# Feature: docs-regla-de-fuente-de-verdad-entre-documentos

Issue: https://github.com/eliumontoya/travelhub-app/issues/375
Branch: `eliumontoya/docs-regla-de-fuente-de-verdad-entre-documentos` (worktree dedicado)
Persistence: hybrid (openspec change + Engram mirror `odd/docs-regla-de-fuente-de-verdad-entre-documentos/tasks`)
Scope decision: the user approved all 4 issue parts in this single PR (overrides the issue's one-PR-per-part note).

## Tasks

- [x] T1 — Parte 1: tabla de fuente de verdad en `README.md`, referenciada desde `AGENTS.md`.
- [x] T2 — Parte 2: desduplicar `project.md` vs `PRODUCT.md` dejando cross-references según la tabla.
- [x] T3 — Parte 3: regla de actualización de docs por PR (AGENTS.md / guía de PR).
- [x] T4 — Parte 4: `doc/adr/` con plantilla ligera y retro-ADRs (portal PIN, multi-cuenta, MCP, fin de mock #372, sort_order).
- [x] T5 — Verificación contra criterio de cierre del issue + commits por parte + push + PR (commits/push/PR parent-owned).

## Evidence log

- T1 — Tabla Tema → Fuente de verdad insertada tras la intro de `README.md`, antes de "## Que hace", con la frase de regla; `AGENTS.md` ahora manda consultarla. Files: `README.md`, `AGENTS.md`.
- T2 — Eliminados de `PRODUCT.md` los pasajes duplicados (Product Purpose, Positioning, Evidence on Hand) reemplazados por cross-references a `project.md`/`README.md`; `project.md` solo ganó una línea hacia `PRODUCT.md`. Verificado que se conservan platform, users, operating context, capabilities/constraints, brand, principles y accessibility. Files: `PRODUCT.md`, `project.md`.
- T3 — `AGENTS.md` extendido: todo PR que cambia comportamiento verifica si algún documento de la tabla envejeció, igual que los tests. Files: `AGENTS.md`.
- T4 — Creado `doc/adr/README.md` (índice + plantilla `Fecha`/`Contexto`/`Decisión`/`Consecuencias`, estado `accepted`) y cinco ADR en español: 0001 portal email+PIN, 0002 multi-cuenta roles/features, 0003 servidor MCP, 0004 fin del mock (#372), 0005 botones ↑/↓. Files: `doc/adr/README.md`, `doc/adr/0001-portal-cliente-email-pin.md`, `doc/adr/0002-multi-cuenta-roles-feature-flags.md`, `doc/adr/0003-servidor-mcp.md`, `doc/adr/0004-supabase-siempre-configurado.md`, `doc/adr/0005-botones-sort-order.md`.
- T5 (parcial) — Criterio de cierre verificado (tabla referenciada desde AGENTS.md, sin duplicación project/PRODUCT, `doc/adr/` con retro-ADRs). Commits/push/PR quedan para el orquestador.
- Verify (gentle-ai-verify, task muudynof-2-8lvb): PASS WITH WARNINGS. Los 7 criterios PASS; avisos = contradicción mock-mode preexistente (README.md:74, PRODUCT.md:26 vs architecture.md:106, documentada en ADR 0004) y drift de conteo MCP (Changes.md "41+" vs architecture.md 57 tools). Follow-ups reportados en el PR.
- Commits: dc583f1 (Partes 1+3), cffcc41 (Parte 2), da33eab (Parte 4).
- Contradicción detectada (no corregida por restricción de no reescribir): `README.md` y `PRODUCT.md` aún describen modo mock in-memory mientras `architecture.md` lo da por eliminado en #372. Registrado en ADR 0004 y reportado para issue de seguimiento.
