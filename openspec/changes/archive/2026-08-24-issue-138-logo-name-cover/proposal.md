# Proposal: Logo y nombre en el cover (issue #138)

## Problem

El cover (hero) de la vista pública `/t/[slug]` solo muestra el título y las
fechas del viaje. El agente de viajes no puede marcar el itinerario con su
**logo** y **nombre de agencia**, lo que resta identidad de marca al entregar el
itinerario al cliente final.

## Proposed approach

Añadir `agencyName` y `logoUrl` al singleton `site_settings` (ya usado para el
contacto del cover). Exponer ambos campos en `/dashboard/settings` y renderizarlos
como una firma de marca en la esquina del cover de `/t/[slug]`.

- El logo se sube a un nuevo bucket público `site-assets` (patrón idéntico a
  `trip-photos`), y se guarda su URL pública en `logo_url`.
- `agencyName` es texto libre; ambos campos son opcionales y degradan con gracia
  (si no hay logo/nombre, el cover queda igual que hoy).

## Out of scope

- No se cambia el modelo de datos de `trips` ni el cover por-viaje.
- No se implementa recorte (crop) ni variantes de tamaño del logo.

## Assumptions

- "cover" = el hero de la vista pública del itinerario (`/t/[slug]`).
- El logo se aloja en Supabase Storage; en modo mock solo se admite URL manual.
