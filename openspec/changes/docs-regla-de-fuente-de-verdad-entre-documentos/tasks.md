# Tasks: docs-regla-de-fuente-de-verdad-entre-documentos

Workload: ~5 archivos tocados + 6 archivos nuevos; solo documentación, sin build ni tests aplicables.

## Phase 1 — Tabla de fuente de verdad (Parte 1)

- [x] T1.1 Añadir en `README.md` la tabla Tema → Fuente de verdad (negocio → project.md; técnica → architecture.md; producto → PRODUCT.md; diseño/UI → DESIGN.md; novedades usuario → Changes.md; decisiones estructurales → doc/adr/; detalle agente WhatsApp → doc/whatsapp-inbound-agent-architecture.md), con una frase de regla: un tema se documenta en su fuente y se enlaza desde el resto.
- [x] T1.2 Referenciar la tabla desde `AGENTS.md` (sección de lectura obligatoria): leer `project.md`/`architecture.md` y consultar la tabla para decidir dónde documentar cada tipo de cambio.

## Phase 2 — Desduplicación project.md vs PRODUCT.md (Parte 2)

- [x] T2.1 Lectura en paralelo y eliminación de pasajes duplicados (propósito, usuarios, posicionamiento), dejando cross-references según la tabla; `project.md` conserva la voz de negocio en español, `PRODUCT.md` conserva usuarios/principios/accesibilidad y apunta a `project.md` para propósito extendido.
- [x] T2.2 Verificar que ningún hecho se pierde: solo se elimina lo duplicado; los cross-references usan rutas relativas.

## Phase 3 — Regla de actualización por PR (Parte 3)

- [x] T3.1 Escribir la regla en `AGENTS.md`: todo PR que cambia comportamiento verifica si algún documento de la tabla envejeció, igual que hoy se verifican tests; la verificación de docs es parte del checklist de PR.

## Phase 4 — ADRs ligeros (Parte 4)

- [x] T4.1 Crear `doc/adr/README.md` (índice + plantilla mínima: contexto, decisión, consecuencias, fecha).
- [x] T4.2 Retro-registrar: 0001 portal cliente email+PIN coexistiendo con URL pública; 0002 multi-cuenta con roles y feature flags por agente; 0003 servidor MCP para agentes IA externos; 0004 eliminación del modo mock (#372); 0005 botones ↑/↓ sobre sort_order en vez de drag-and-drop.

## Phase 5 — Verificación y cierre

- [x] T5.1 Criterio de cierre del issue: tabla referenciada desde AGENTS.md; sin pasajes duplicados project/PRODUCT; doc/adr/ con los retro-ADRs; un lector nuevo puede responder "¿dónde documento esto?".
- [x] T5.2 Commits por parte (parent-owned: sin commits en esta tarea) (Conventional Commits), push y PR con `Closes #375`.
