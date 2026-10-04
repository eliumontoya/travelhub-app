# Decisiones de arquitectura (ADR)

Registro ligero de las decisiones estructurales ya tomadas en TravelHub. Cada
ADR es corto: fecha, contexto, decisión y consecuencias. El estado por defecto
es `accepted`; cuando una decisión se reemplaza, se deja el ADR original y se
agrega uno nuevo que la supersede.

Esta carpeta es la fuente de verdad de las decisiones estructurales (ver la
tabla de fuentes de verdad en `README.md`).

## Índice

| ADR | Título | Estado |
|-----|--------|--------|
| [0001](0001-portal-cliente-email-pin.md) | Portal de cliente autenticado con email + PIN, coexistiendo con la URL pública del itinerario | accepted |
| [0002](0002-multi-cuenta-roles-feature-flags.md) | Multi-cuenta de agentes con roles (admin/agent) y feature flags por agente | accepted |
| [0003](0003-servidor-mcp.md) | Servidor MCP propio para agentes IA externos | accepted |
| [0004](0004-supabase-siempre-configurado.md) | Eliminación del modo mock in-memory en favor de Supabase siempre configurado | accepted |
| [0005](0005-botones-sort-order.md) | Botones ↑/↓ sobre `sort_order` en vez de drag-and-drop para ordenar items del itinerario | accepted |

## Plantilla

```md
# ADR NNNN — Título

- **Estado**: accepted

## Fecha

YYYY-MM-DD

## Contexto

Qué problema o restricción obligó a decidir.

## Decisión

Qué se decidió, en una o dos frases.

## Consecuencias

Qué se gana, qué se acepta como costo y qué queda pendiente.
```
