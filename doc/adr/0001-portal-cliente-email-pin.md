# ADR 0001 — Portal de cliente autenticado con email + PIN, coexistiendo con la URL pública del itinerario

- **Estado**: accepted

## Fecha

2026-09-18

## Contexto

El objetivo de negocio es que el cliente final tenga su viaje en un solo lugar
sin fricción, pero también que pueda participar activamente cuando el viaje lo
requiere (documentación, visas, actividades propias). Un único modelo de acceso
no cubre ambos casos: pedir cuenta para todo agrega fricción a la consulta
rápida, y dejar todo público no permite entregar documentos ni seguir un
proceso privado por cliente. `project.md` describe esto como "dos formas
complementarias de acceso" (Solución Propuesta).

## Decisión

Mantener dos superficies de acceso que conviven y no se excluyen:

- **Enlace público, sin cuenta**: `/t/{slug}` muestra el itinerario publicado
  (solo viajes `published` por RLS) y `/c/{slug}` el historial público.
- **Portal autenticado del cliente**: `/client/**` con email + PIN propio del
  cliente (hash bcrypt en `clients.pin_hash`, cookie de sesión firmada con HMAC
  `th-client-session`), separado de Supabase Auth.

## Consecuencias

- Se gana la consulta sin fricción y, cuando hace falta, la participación
  autenticada (subir documentos, seguir visas, agregar/editar/eliminar
  actividades propias sobre un itinerario publicado).
- Se aceptan dos sistemas de autenticación y dos contratos de sesión que hay
  que mantener: Supabase Auth para agentes y sesión PIN propia para clientes,
  con rate limiting de intentos fallidos.
- Referencias: `project.md` (Solución Propuesta → dos formas complementarias de
  acceso), `architecture.md` (Subsistemas → Portal del cliente), `Changes.md`
  (2026-09-18 — Portal del cliente con login PIN).
