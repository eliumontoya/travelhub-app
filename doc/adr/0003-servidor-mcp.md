# ADR 0003 — Servidor MCP propio para agentes IA externos

- **Estado**: accepted

## Fecha

2026-09-21

## Contexto

El negocio quiere que un asistente de IA externo pueda consultar y operar
sobre la información del agente de forma autorizada, sin exportaciones
manuales. `project.md` lo describe como exponer la funcionalidad de la
plataforma a asistentes de inteligencia artificial externos mediante una
integración autorizada.

## Decisión

Exponer un servidor Model Context Protocol propio en `/api/mcp`, dentro de la
misma app Next.js, con módulos de herramientas en `src/lib/mcp/**`. La ruta
atiende POST/GET/DELETE con transporte Streamable HTTP y exige
`Authorization: Bearer <MCP_API_KEY>` (admite varias claves para rotación), y
requiere service role configurado.

## Consecuencias

- Se gana operar la misma información desde el cliente de IA que el agente
  prefiera, sin exportaciones manuales.
- Se acepta mantener una superficie de herramientas extra (a la fecha,
  `architecture.md` registra 11 módulos con 57 tools) y una clave dedicada
  (`MCP_API_KEY`), además de service role para operar.
- Referencias: `project.md` (Solución Propuesta → integración con asistentes de
  IA externos), `architecture.md` (Subsistemas → Servidor MCP; Stack →
  `/api/mcp`), `Changes.md` (2026-09-21 — Herramientas MCP para agentes IA).
