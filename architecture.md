# Arquitectura de TravelHub

Referencia técnica para cualquier desarrollador (humano o agente IA) que se
incorpore al proyecto. Sin detalles de negocio — eso vive en `project.md`.

Este documento describe la arquitectura tal como está hoy. El esquema de datos,
las políticas de RLS y los buckets de Storage viven en `supabase/migrations/`;
la arquitectura detallada del agente WhatsApp y del WCC vive en
`doc/whatsapp-inbound-agent-architecture.md`; las novedades orientadas al
usuario viven en `Changes.md`. No se duplican acá.

## Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Estilos**: Tailwind CSS 4
- **Base de datos**: Postgres, gestionado por Supabase
- **Auth de agente**: Supabase Auth (email + contraseña). Cuentas con rol
  `admin`/`agent`, sin registro público
- **Auth de cliente**: email + PIN propio del cliente (hash bcrypt + cookie de
  sesión firmada), separado de Supabase Auth
- **Storage de archivos**: Supabase Storage (buckets privados `trip-documents`
  y `visa-documents`)
- **Hosting**: Vercel (deploy automático al hacer push a `main`)
- **Mapas/ubicación** (opcionales): Google Maps Embed API y Google Places
  Autocomplete — activados solo si sus API keys están configuradas
- **Email** (opcional): Resend para el recordatorio automático antes del viaje
- **WhatsApp/IA**: webhook inbound + WCC (ver `doc/whatsapp-inbound-agent-architecture.md`)
- **Integraciones de agentes IA**: servidor MCP propio expuesto en `/api/mcp`
- **Testing**: Vitest (unit) + Playwright (E2E)

## Arquitectura de alto nivel

```
Cliente (browser)
   │
   ├── /dashboard/**        (autenticado, agente/admin)
   │      Server Components + Server Actions → @/lib/data/* → Supabase
   │
   ├── /client/**           (autenticado con PIN de cliente)
   │      Server Components + Server Actions → @/lib/data/* → Supabase
   │
   ├── /t/{slug}            (público, sin login, RLS: solo published)
   ├── /c/{slug}            (público, historial de viajes publicados del cliente)
   │
   ├── /api/whatsapp/**     (webhook inbound de WhatsApp)
   ├── /api/wcc/knowledge/** (import/export Excel de la base de conocimiento)
   ├── /api/mcp             (servidor MCP)
   ├── /api/flight-status   (consulta manual de estado de vuelos)
   └── /api/cron/**         (recordatorios automáticos por email)
```

- Todo el frontend y backend viven en la misma app Next.js — no hay un
  servidor API separado. Las mutaciones se hacen con **Server Actions**
  (`"use server"`). Las pocas rutas API existen solo para lo que no encaja en
  una Server Action: webhooks, el servidor MCP, el cron de recordatorios,
  descargas/importaciones de archivos y la consulta de estado de vuelos.
- `src/middleware.ts` protege todas las rutas bajo `/dashboard/**`,
  redirigiendo a `/login` si no hay sesión de Supabase. En modo mock aplica el
  mismo modelo de roles usando la cookie `x-mock-account-id`.
- Las rutas de `/client/**` no pasan por el middleware: cada página y Server
  Action resuelve la sesión de cliente con `getClientSession()`
  (`src/lib/client-auth.ts`) y redirige a `/client/login` si no existe.
- Las superficies públicas sin login son `/t/{slug}` (itinerario publicado) y
  `/c/{slug}` (historial de viajes publicados del cliente). Se apoyan en las
  políticas de Row Level Security para exponer únicamente datos publicados.

## Capa de datos: fachada + módulos por dominio

`src/lib/data.ts` es una **fachada de compatibilidad**: solo reexporta los
módulos de `src/lib/data/*`. Las páginas y Server Actions pueden seguir
importando desde `@/lib/data`, pero la implementación real vive separada por
responsabilidad.

| Archivo | Responsabilidad |
|---------|-----------------|
| `data/shared.ts` | Helpers comunes: cliente server de Supabase, mock/Supabase switch, paginación, slugs, sanitización, chequeo de service role. |
| `data/clients.ts` | Clientes, tags, cumpleaños, fuentes de referido, asociaciones cliente/tag, hash del PIN y perfil/historial público del cliente. |
| `data/profiles.ts` | Perfiles de cuenta (`profiles`): rol, features habilitadas y lectura/escritura para la gestión de permisos. |
| `data/suppliers.ts` | Proveedores, conteos relacionados y soft delete/restore. |
| `data/travel-agents.ts` | Catálogo de agentes de viaje y su asignación a viajes. |
| `data/trips.ts` | Viajes, días, items, templates, packing list, historial, recordatorios, notas internas y métricas de viaje. |
| `data/documents.ts` | Supabase Storage, documentos de items, fotos, portadas y logos (viaje/cliente/sitio). |
| `data/services.ts` | Servicios por viaje, checklist de documentos, uploads, estados de revisión y progreso del cliente. |
| `data/visas.ts` | Solicitudes de visa, transiciones de estado, historial y asociaciones visa/cliente. |
| `data/visa-documents.ts` | Documentos de visa: solicitudes, uploads, URLs firmadas y estados de revisión. |
| `data/dashboard.ts` | Agregados para dashboard y actividad reciente. |
| `data/settings.ts` | Configuración editable del sitio. |
| `data/feedback.ts` | Feedback público de viajes. |

Cada módulo conserva el modo dual:

- **Si Supabase está configurado** (`isSupabaseConfigured()`): lee/escribe en
  Postgres/Storage.
- **Si no**: usa los datos en memoria de `src/lib/mock-data.ts`.

Esto permite levantar el proyecto sin cuenta de Supabase.

### Frontera de acceso a datos

- Las páginas, Server Actions y componentes **no hablan directo con Supabase ni
  con `mock-data.ts`**: atraviesan `@/lib/data`. Toda la lógica de datos debe
  vivir en el módulo de dominio correspondiente.
- `src/lib/data.ts` no debe volver a tener lógica: solo exports.
- `mock-data.ts` es un detalle interno de la capa de datos/auth. Solo lo
  importan los módulos de `src/lib/data/*`, `src/lib/auth/roles.ts`,
  `src/lib/client-auth.ts` y `src/middleware.ts` (resolución de la cuenta/rol
  mock). Nunca debe importarse desde páginas, Server Actions, componentes ni
  rutas API.
- El subsistema WCC tiene su propia familia de módulos de dominio
  (`src/lib/wcc-*.ts`), que encapsula el acceso al cliente de Supabase y
  mantiene la misma frontera: las páginas y Server Actions del WCC no hablan
  directo con Supabase.

### Excepciones registradas a la regla de acceso a datos

Estos archivos tocan `@/lib/supabase/server` directamente por una razón de
autenticación/infraestructura, no de datos de dominio. Son excepciones
deliberadas y acotadas:

| Ruta | Por qué es una excepción legítima |
|------|-----------------------------------|
| `src/app/login/actions.ts` | Crea la sesión de agente con `supabase.auth.signInWithPassword`; es una operación de autenticación, no un acceso a datos de dominio. |
| `src/app/login/page.tsx` | Llama `isSupabaseConfigured()` para decidir si renderiza el formulario o el aviso de configuración. |
| `src/app/dashboard/layout.tsx` | Resuelve la sesión/cuenta activa (`auth.getUser()`) para el menú de perfil; el resto de los datos los lee vía `@/lib/data`. |
| `src/app/dashboard/settings/actions.ts` | Cierra la sesión de agente con `auth.signOut()`; la lectura/escritura de ajustes y logo sí pasa por `@/lib/data`. |
| `src/app/api/wcc/knowledge/import/route.ts` | Importación masiva de Excel: crea un cliente service-role por fila directamente contra `whatsapp_knowledge_entries`; no es una Server Action ni un flujo de UI. |
| `src/app/api/wcc/knowledge/export/route.ts` | Exportación XLSX en streaming con service-role para leer la base de conocimiento completa y devolverla con headers de descarga. |

### Reglas anti-monolito

- Nueva lógica de datos debe vivir en el módulo de dominio más cercano. Si toca
  dos dominios, dejar el orquestador en el dominio dueño del caso de uso y los
  helpers compartidos en `data/shared.ts`.
- Mappers `rowTo*` se quedan junto al dominio que conoce esa tabla.
- Código de Storage va en `data/documents.ts` (o `data/visa-documents.ts`), no
  mezclado con viajes/clientes.
- Agregados de lectura para widgets viven en `data/dashboard.ts`; no deben
  crecer dentro de páginas.
- Antes de mover o partir funciones, fijar contratos con tests en
  `src/lib/__tests__/` o `src/lib/data/__tests__/`.

## Subsistemas

### Portal del cliente (`/client/**`, `/c/{slug}`)

Segunda superficie autenticada, separada del workspace del agente:

- **Login**: email + PIN. El PIN se guarda como hash bcrypt en `clients.pin_hash`
  (`20260916000000_client_pin_hash.sql`). La sesión es una cookie firmada con
  HMAC (`th-client-session`, secreto `CLIENT_SESSION_SECRET`) gestionada en
  `src/lib/client-auth.ts`. Hay rate limiting de intentos fallidos respaldado
  por `client_login_attempts` (`20260916010000_client_login_attempts.sql`).
- **Rutas**: `/client/login`, `/client` (datos del cliente, viajes, visas y
  progreso de servicios), `/client/trips/{id}/documents` y
  `/client/visas/{id}/documents`.
- **Superficie pública**: `/c/{slug}` (historial de viajes publicados) sigue
  siendo pública. `/t/{slug}` es público para leer, y un cliente autenticado
  puede además agregar/editar/eliminar sus propias actividades (items con
  `created_by_client_id`, creados vía RPCs `security definer`) y dejar
  feedback.

### Multi-cuenta y roles (`profiles`, `travel_agents`)

- `profiles` (`20260916170000_account_profiles.sql`) separa la identidad de
  Supabase Auth de la autorización de la app: rol (`admin`/`agent`), features
  habilitadas y `travel_agent_id` opcional. RLS de auto-lectura + lectura de
  admin; el provisionamiento es manual.
- `src/lib/auth/roles.ts` resuelve la cuenta y expone los guards
  `requireFeature`/`requireAdmin`; `src/lib/auth/features.ts` es el catálogo
  de features. El admin habilita features por agente en
  `/dashboard/settings/accounts`.
- El catálogo de agentes de viaje se administra en `/dashboard/travel-agents`
  (`data/travel-agents.ts`, `0041_travel_agents.sql`).

### WCC — WhatsApp Command Center (`/dashboard/wcc/**`)

Panel del agente WhatsApp dentro del dashboard: conversaciones, contactos,
escalaciones y base de conocimiento. Está protegido por
`requireFeature("whatsapp")` en `src/app/dashboard/wcc/layout.tsx`, y lee/escribe
a través de la familia `src/lib/wcc-*.ts` (que usa el cliente service-role
cuando está configurado). La importación/exportación masiva de la base de
conocimiento se hace desde `/api/wcc/knowledge/{import,export}`.

Para el flujo inbound, tablas, variables y reglas del agente, ver
`doc/whatsapp-inbound-agent-architecture.md`. La observabilidad asociada se
describe más abajo.

### Servidor MCP (`src/lib/mcp/**`, `/api/mcp`)

Servidor Model Context Protocol que expone herramientas de TravelHub a agentes
IA externos. `src/lib/mcp/server.ts` registra **11 módulos de herramientas con
57 tools** (clientes, viajes, días, items, packing, notas internas, documentos,
servicios, proveedores, agentes de viaje y actividades). La ruta `/api/mcp`
atiende POST/GET/DELETE con el transporte Streamable HTTP y exige
`Authorization: Bearer <MCP_API_KEY>` (admite lista separada por comas para
rotación). Requiere service role configurado. Detalle de uso y cambios de
producto: `Changes.md`.

## Estructura de carpetas relevantes

```
src/
  app/
    dashboard/              -- área autenticada (agente/admin)
      page.tsx               listado de clientes y viajes
      clients/[id]/          ficha de cliente (ver/editar, historial)
      trips/new/              alta de viaje (+ cliente nuevo o existente)
      trips/[id]/             editor de viaje: días, items, publicar
      trips/[id]/quote/       cotización del viaje
      suppliers/              catálogo de proveedores
      travel-agents/          catálogo de agentes de viaje
      visas/                  solicitudes de visa y documentos
      settings/               ajustes del sitio
        accounts/             permisos/features por agente (solo admin)
      wcc/                    WhatsApp Command Center (contacts, conversations,
                              escalations, knowledge)
    client/                 -- portal del cliente (login PIN + sesión propia)
      login/                  login de cliente
      trips/[id]/documents/   documentos solicitados por viaje
      visas/[id]/documents/   documentos solicitados por visa
    c/[slug]/               -- historial público de viajes del cliente
    t/[slug]/               -- itinerario público del viaje (sin auth)
    login/                  -- login del agente
    api/
      whatsapp/webhook/       webhook inbound de WhatsApp
      wcc/knowledge/          import/export Excel de la base de conocimiento
      mcp/                    servidor MCP
      flight-status/          consulta de estado de vuelos
      cron/trip-reminders/    recordatorios automáticos por email
  components/               -- componentes reutilizables (dialogs, combobox,
                               botones de calendario/QR/mapa, UI del operador)
  lib/
    data.ts                 -- fachada pública; solo reexporta src/lib/data/*
    data/
      shared.ts              helpers comunes, paginación, mock/Supabase switch
      clients.ts             clientes, tags, cumpleaños, referidos, PIN
      profiles.ts            perfiles de cuenta (rol + features)
      suppliers.ts           proveedores
      travel-agents.ts       catálogo de agentes de viaje
      trips.ts               viajes, días, items, templates, packing, reminders
      documents.ts           documentos, fotos, portadas, logos, storage
      services.ts            servicios, checklist y uploads de documentos
      visas.ts               solicitudes de visa y transiciones
      visa-documents.ts      documentos de visa y URLs firmadas
      dashboard.ts           agregados para dashboard
      settings.ts            configuración del sitio
      feedback.ts            feedback de viajes
    client-auth.ts          -- sesión y rate limit del portal de cliente
    auth/
      roles.ts                resolución de cuenta/rol y guards
      features.ts             catálogo de features por agente
    wcc-*.ts                -- familia de datos del WCC (dashboard, contacts,
                               conversations, escalations, knowledge)
    whatsapp/               -- servicio inbound (store, normalize, signature…)
    mcp/                    -- servidor MCP, auth y módulos de tools
    mock-data.ts            -- datos de prueba en memoria (uso interno de la capa de datos)
    supabase/
      client.ts               cliente de Supabase para el browser
      server.ts                cliente de Supabase para Server Components/Actions
      middleware.ts            refresco de sesión en el middleware
    observability/
      whatsapp-ai.ts           eventos, sanitización y métricas WhatsApp/IA
    ics.ts                  -- generación de archivos .ics
    item-meta.ts            -- labels/iconos por tipo de item, formateo de fechas
  types/index.ts            -- tipos de dominio (Client, Trip, TripDay, Item, …)
  middleware.ts              -- protección de /dashboard/** por rol
```

## Modelo de datos (resumen)

El modelo se extendió más allá de la cadena
`clients → trips → trip_days → items → documents`. Hoy cubre, entre otros
dominios:

- **Clientes y relaciones**: `clients`, `client_tags`, `tags`, `trip_clients`,
  `trip_tags`, `client_documents`, `client_login_attempts`.
- **Viajes e itinerario**: `trips` (comisión, moneda, feedback, plantillas,
  estado, recordatorios, notas internas), `trip_days`, `items` (incluye las
  actividades creadas por viajeros vía `created_by_client_id`),
  `documents`, `trip_documents`, `trip_photos`, `packing_items`,
  `trip_status_history`, `trip_feedback`.
- **Proveedores**: `suppliers`, `supplier_tags`.
- **Servicios**: `services`, `service_checklist_items`, `service_uploads`.
- **Visas**: `visas`, `visa_documents`, `visa_status_history`, `visa_clients`.
- **Cuentas**: `profiles`, `travel_agents`.
- **WhatsApp/WCC**: tablas `whatsapp_*` (contactos, conversaciones, mensajes,
  status callbacks, intenciones, escalaciones y base de conocimiento) más
  `crm_sync_events`.

El **esquema completo, los tipos y las políticas de RLS viven en
`supabase/migrations/`** — es la fuente de verdad y no se reproduce acá. Hay
dos convenciones de nombres coexistiendo:

- Secuencial: `0001_…` hasta `0041_…`, con un hueco en `0034`–`0038`.
- Timestamp: `YYYYMMDDHHMMSS_…` (una excepción usa solo fecha:
  `20260918_traveler_activities.sql`).

Cada migración lleva comentarios SQL explicando qué política hace qué; al
tocar el modelo, agregar una migración nueva en lugar de editar las existentes.

## Observabilidad WhatsApp/IA

Las rutas y servicios del agente WhatsApp/IA deben emitir telemetría mediante
`src/lib/observability/whatsapp-ai.ts`. Esta capa es la única responsable de:

- crear y propagar `correlationId`/`eventId`;
- sanitizar errores, teléfonos, URLs privadas, prompts, completions, tokens,
  payloads raw, SQL y stack traces;
- producir logs estructurados y métricas operativas en memoria para WCC.

Regla para nuevas features del agente WhatsApp: no usar `console.log` directo
ni logs ad-hoc. Cada webhook, decisión IA, tool, envío, status callback o
escalación relevante debe registrar un evento typed y sanitizado. Si la
observabilidad falla, nunca debe bloquear la respuesta a WhatsApp.

## Entornos y variables

Las keys se obtienen del panel del proyecto Supabase (Project Settings → API)
y se cargan en `.env.local` en dev o en las variables de entorno de Vercel.
Variables relevantes:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — conexión pública a Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — uso server-side únicamente, nunca exponer al cliente
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — opcional, activa autocomplete de ubicación y mapa embebido
- `RESEND_API_KEY` — opcional, activa el recordatorio automático por email antes del viaje (ver `src/lib/email.ts` y `src/app/api/cron/trip-reminders/route.ts`)
- `EMAIL_FROM` — opcional, remitente del recordatorio (default `TravelHub <onboarding@resend.dev>`)
- `TRIP_REMINDER_DAYS_BEFORE` — opcional, días de anticipación del recordatorio (default 3)
- `CRON_SECRET` — requerido y no vacío en producción para el endpoint de recordatorios; el cron debe enviar `Authorization: Bearer <valor>`. También se recomienda configurarlo en deploys compartidos o de preview.
- `NEXT_PUBLIC_SITE_URL` — opcional, base de la URL pública usada en el email de recordatorio (fallback: `VERCEL_URL` o `localhost:3000`)
- `FLIGHT_API_KEY` — opcional, server-side, activa la consulta manual de estado de vuelos (Aviationstack) en items tipo `flight`; usa solo el campo estructurado `Número de vuelo`
- `NEXT_PUBLIC_FLIGHT_STATUS_CACHE_HOURS` — opcional, client-side, duración del cache local del estado de vuelo en horas (default 24)
- `CLIENT_SESSION_SECRET` — secreto para firmar la cookie de sesión del portal de cliente; en producción no debe quedar vacío
- `MCP_API_KEY` — requerido por `/api/mcp`; admite una o varias claves separadas por comas para rotación

Las variables del agente WhatsApp (`WHATSAPP_*`, modelo IA, alerta humana)
están documentadas en `doc/whatsapp-inbound-agent-architecture.md`.

## Deploy

- **Producción**: Vercel, deploy automático en cada push a `main` (no hay
  ambiente de staging separado por ahora).
- **Local**: `npm run dev` (puerto 3000). Funciona sin Supabase configurado
  (modo mock).
- Verificación antes de commitear: `npx tsc --noEmit` y `npm run build`
  deben pasar limpios.

## Convenciones de código

- Sin comentarios en TS/TSX salvo que expliquen un porqué no obvio (SQL sí
  puede llevar comentarios explicativos de las políticas).
- Server Components por default; `"use client"` solo donde se necesita
  interactividad real (formularios con estado, combobox, botones que tocan
  `window`/`navigator`).
- Mutaciones vía Server Actions co-ubicadas en `actions.ts` dentro de cada
  ruta (ej. `src/app/dashboard/trips/[id]/actions.ts`).
- Las páginas y Server Actions no deben hablar directo con Supabase ni con
  `mock-data.ts`; siempre atraviesan `@/lib/data` (o el módulo de dominio que
  corresponda). Las únicas excepciones son las registradas más arriba.
- La capa `src/lib/data/*` debe mantener funciones pequeñas por caso de uso y
  evitar mezclar UI, navegación, cookies o lógica de formularios.
- Las features por agente se resuelven con los guards de `src/lib/auth/roles.ts`
  y el catálogo de `src/lib/auth/features.ts`; no hardcodear rutas ni permisos.
- Reordenar listas (días, items) usa botones ↑/↓ sobre `sort_order` —
  decisión deliberada de no usar librerías de drag-and-drop, dado el volumen
  de uso esperado.
- Toda feature que dependa de una API key externa (Supabase, Google
  Maps/Places) debe degradar con gracia si la key no está configurada, no
  debe requerirla para que la app funcione en modo básico.
- Toda feature nueva de WhatsApp/IA debe propagar el contexto de
  observabilidad existente y tener pruebas si agrega nuevos tipos de evento o
  diagnósticos.
- Si un archivo de dominio empieza a acumular responsabilidades no relacionadas,
  crear un submódulo antes de que pase de ser revisable. Regla práctica:
  preferir PRs pequeños; si una extracción supera ~400 líneas cambiadas,
  documentar la excepción o partirla.
