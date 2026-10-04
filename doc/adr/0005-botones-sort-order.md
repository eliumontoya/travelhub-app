# ADR 0005 — Botones ↑/↓ sobre `sort_order` en vez de drag-and-drop para ordenar items del itinerario

- **Estado**: accepted

## Fecha

Sin fecha exacta documentada; retro-registrada el 2026-10-04.

## Contexto

Los días y los items del itinerario necesitan un orden editable. La opción
obvia era sumar una librería de drag-and-drop, que agrega peso, dependencia y
superficie de interacción (táctil y accesible) para un uso de volumen bajo.

## Decisión

Reordenar listas (días e items) con botones ↑/↓ que persisten `sort_order` en
la base. No se incorporan librerías de drag-and-drop.

## Consecuencias

- Se gana una interacción simple, accesible por teclado y sin dependencias
  nuevas.
- Se acepta un reordenamiento de a un paso por vez, suficiente para el volumen
  de uso esperado.
- Referencia: `architecture.md` (Convenciones de código → "Reordenar listas
  (días, items) usa botones ↑/↓ sobre `sort_order`").
