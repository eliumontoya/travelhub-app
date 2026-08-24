# Proposal: Enviar itinerario por correo (issue #136)

## Intent

Dar al agente de viajes la capacidad de **enviar el itinerario completo de un viaje
por correo electrónico** directamente desde el editor del viaje en `/dashboard`. Hoy
el único canal de correo existente es un *recordatorio automático* (cron, a `N` días del
inicio) que solo manda un enlace. El issue pide enviar el itinerario en sí.

## Scope

- Nueva acción manual en el editor de viaje (`/dashboard/trips/[id]`): un diálogo
  donde el agente confirma/ajusta los destinatarios (pre-cargados con el email de los
  clientes asignados) y opcionalmente añade un mensaje personalizado.
- El correo incluye el itinerario renderizado en HTML (días, items, horarios,
  ubicaciones, códigos de confirmación) más un enlace a la vista pública `/t/[slug]`.
- Reutiliza la infraestructura de envío existente (`src/lib/email.ts` → Resend) y el
  mismo patrón de *degradación elegante* si `RESEND_API_KEY` no está configurada.

## Non-goals

- No se implementa envío automático ni programado (ya existe el recordatorio).
- No se adjuntan documentos/archivos (boarding passes, vouchers) en este primer slice.
- No se crea una nueva columna de BD para registrar el envío (se podría añadir después).

## Assumptions

- El destinatario por defecto es el/los emails de los clientes asignados al viaje.
- El correo puede enviarse a varios destinatarios (separados por coma).
- Si `RESEND_API_KEY` no está configurada, la acción degrada con un mensaje claro en
  lugar de romper la UI (igual que el recordatorio).
- El costo de los items solo se incluye en el correo si `showCostsToClient` es `true`.

## Rollback

La feature es aditiva (nueva función en `email.ts`, nueva Server Action, nuevo
componente). Si se revierte, no hay migraciones ni cambios de esquema que deshacer;
basta con eliminar la rama/PR.
