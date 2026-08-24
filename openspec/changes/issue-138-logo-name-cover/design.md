# Design: Logo y nombre en el cover (issue #138)

## Data model

Extender `site_settings` (migración `0031_site_settings_branding.sql`):

```sql
alter table site_settings add column agency_name text not null default '';
alter table site_settings add column logo_url text not null default '';
```

Nuevo bucket público `site-assets` para el logo:

```sql
insert into storage.buckets (id, name, public)
values ('site-assets', 'site-assets', true) on conflict (id) do nothing;
-- RLS: solo dueño autenticado escribe; lectura pública para servir el logo.
```

## Capa de datos (`src/lib/data.ts`)

- `SiteSettings` (types/index.ts): agregar `agencyName?`, `logoUrl?`.
- `getSiteSettings()`: devolver los nuevos campos (mock + Supabase).
- `updateSiteSettings(input)`: propagar `agencyName`/`logoUrl` al patch y al mock.
- `rowToSiteSettings`: mapear `agency_name`/`logo_url`.
- `uploadSiteLogo(file)`: sube a `site-assets`, devuelve URL pública; lanza si
  Supabase no configurado (patrón de `uploadTripPhoto`).

## Server actions (`src/app/dashboard/settings/actions.ts`)

- `updateSettingsAction` extendida: lee `agencyName` y, si hay archivo `logo`,
  sube vía `uploadSiteLogo` y usa la URL resultante; si no, conserva `logoUrl`
  oculto. Valida email/teléfono como hoy.
- Revalida `/t/[slug]` (el cover es global, como el contacto — design D4).

## UI

- `SettingsForm.tsx`: `encType="multipart/form-data"`; inputs para nombre de
  agencia y logo (file + vista previa + campo opcional de URL manual).
- Cover `/t/[slug]`: bloque con `<img>` del logo y `agencyName` en esquina
  superior-izquierda del hero, sobre el gradiente, con `print:hidden`.

## Graceful degradation

Sin Supabase: logo solo por URL manual; sin logo/nombre: cover sin cambios.
