# Spec: Logo y nombre en el cover (issue #138)

## Requirements

### REQ-1: SiteSettings soporta marca
`SiteSettings` debe incluir `agencyName?: string` y `logoUrl?: string`,
persistidos en la columna singleton `site_settings`.

#### Scenario: lectura por defecto
- Given Supabase no configurado
- When se llama `getSiteSettings()`
- Then devuelve `agencyName` y `logoUrl` (vacíos en mock, o los del singleton)

#### Scenario: actualización
- Given campos válidos
- When se llama `updateSiteSettings({ agencyName, logoUrl })`
- Then la fila singleton se actualiza y se revalida `/t/[slug]`

### REQ-2: Configuración en el dashboard
El formulario de `/dashboard/settings` permite editar el nombre de agencia y
subir/reemplazar el logo, además de email/teléfono existentes.

#### Scenario: guardar marca
- Given un usuario autenticado en settings
- When completa nombre y sube un logo
- Then `agencyName` y `logoUrl` se persisten y el cover los refleja

#### Scenario: modo mock sin Supabase
- Given Supabase no configurado
- When el usuario pega una URL manual de logo
- Then `logoUrl` se guarda igualmente (sin subida a Storage)

### REQ-3: Render del cover
El cover de `/t/[slug]` muestra el logo y el nombre de agencia cuando existen.

#### Scenario: con marca
- Given `logoUrl` y `agencyName` configurados
- When un cliente abre el itinerario publicado
- Then el cover muestra logo + nombre en una esquina, sin tapar título/fechas

#### Scenario: sin marca
- Given `logoUrl` o `agencyName` vacíos
- Then el cover se renderiza como hoy (sin regresión)

## Acceptance

- `npx tsc --noEmit` y `npm run build` pasan.
- Los 3 escenarios de REQ-3 verificables manualmente en `/t/[slug]`.
