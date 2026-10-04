# ADR 0002 — Multi-cuenta de agentes con roles (admin/agent) y feature flags por agente

- **Estado**: accepted

## Fecha

2026-09-16 (roles) y 2026-09-25 (feature flags por agente)

## Contexto

El negocio pasa de una sola persona a varias, y necesita dar acceso ordenado
por rol en lugar de multiplicar instalaciones. `project.md` pide que la misma
instalación pueda alojar más de una cuenta de agente, cada una con su espacio
de trabajo y con los módulos que tenga habilitados, y que un rol administrador
defina qué módulos ve cada agente.

## Decisión

Separar identidad de autorización en `profiles` y resolver permisos con:

- Rol `admin`/`agent` sobre `profiles`, sin registro público.
- Guards `requireFeature`/`requireAdmin` en `src/lib/auth/roles.ts` y catálogo
  de features en `src/lib/auth/features.ts`.
- Feature flags por agente que el admin habilita en
  `/dashboard/settings/accounts`.
- Catálogo de agentes de viaje (`travel_agents`) para asignar viajes.

## Consecuencias

- Se gana operar varias cuentas bajo una sola instalación con planes y
  permisos granulares, sin duplicar despliegues.
- Se acepta que los permisos no se hardcodean: toda ruta o módulo nuevo debe
  declarar su feature en el catálogo y pasar por los guards.
- El provisionamiento de cuentas es manual (no hay auto-registro).
- Referencias: `project.md` (Solución Propuesta → varias cuentas de agente con
  rol administrador), `architecture.md` (Subsistemas → Multi-cuenta y roles),
  `Changes.md` (2026-09-16 — Roles de cuenta y permisos; 2026-09-25 — Control
  de features por agente).
