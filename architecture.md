# Arquitectura de TravelHub

Referencia técnica para cualquier desarrollador (humano o agente IA) que se
incorpore al proyecto. Sin detalles de negocio — eso vive en `project.md`.

## Stack

- **Framework**: Next.js (App Router) + TypeScript
- **Estilos**: Tailwind CSS
- **Base de datos**: Postgres, gestionado por Supabase
- **Auth**: Supabase Auth (email + contraseña, un solo usuario admin, sin
  registro público)
- **Storage de archivos**: Supabase Storage (bucket privado `trip-documents`)
- **Hosting**: Vercel (deploy automático al hacer push a `main`)
- **Mapas/ubicación** (opcionales): Google Maps Embed API y Google Places
  Autocomplete — activados solo si sus API keys están configuradas

## Arquitectura de alto nivel

```
Cliente (browser)
   │
   ├── /dashboard/**  (autenticado, agente de viajes)
   │      Server Components + Server Actions → src/lib/data.ts → src/lib/data/* → Supabase
   │
   └── /t/{slug}      (público, sin login, para el cliente final)
          Server Component → src/lib/data.ts → src/lib/data/trips.ts → Supabase
          (RLS: solo published)
```

- Todo el frontend y backend viven en la misma app Next.js — no hay un
  servidor API separado. Las mutaciones se hacen con **Server Actions**
  (`"use server"`), no con rutas API REST propias.
- `src/middleware.ts` protege todas las rutas bajo `/dashboard/**`,
  redirigiendo a `/login` si no hay sesión de Supabase.
- La vista pública (`/t/[slug]`) no requiere autenticación: se apoya en las
  políticas de Row Level Security de Postgres para exponer únicamente los
  viajes con `status = 'published'`.

## Capa de datos: fachada + módulos por dominio

`src/lib/data.ts` es una **fachada de compatibilidad**: solo reexporta los
módulos de `src/lib/data/*`. Las páginas y Server Actions pueden seguir
importando desde `@/lib/data`, pero la implementación real vive separada por
responsabilidad.

| Archivo | Responsabilidad |
|---------|-----------------|
| `data/shared.ts` | Helpers comunes: cliente server de Supabase, mock/Supabase switch, paginación, slugs, sanitización. |
| `data/clients.ts` | Clientes, tags, cumpleaños, fuentes de referido y asociaciones cliente/tag. |
| `data/trips.ts` | Viajes, días, items, templates, packing list, historial, recordatorios y métricas de viaje. |
| `data/documents.ts` | Supabase Storage, documentos, fotos, logos e imágenes de portada. |
| `data/suppliers.ts` | Proveedores y conteos relacionados. |
| `data/dashboard.ts` | Agregados para dashboard y actividad reciente. |
| `data/settings.ts` | Configuración editable del sitio. |
| `data/feedback.ts` | Feedback público de viajes. |

Cada módulo conserva el modo dual:

- **Si Supabase está configurado** (`isSupabaseConfigured()`): lee/escribe en
  Postgres/Storage.
- **Si no**: usa los datos en memoria de `src/lib/mock-data.ts`.

Esto permite levantar el proyecto sin cuenta de Supabase. Nunca importar
`mock-data.ts` directo desde páginas, Server Actions o componentes.

### Reglas anti-monolito

- `src/lib/data.ts` no debe volver a tener lógica: solo exports.
- Nueva lógica de datos debe vivir en el módulo de dominio más cercano. Si toca
  dos dominios, dejar el orquestador en el dominio dueño del caso de uso y los
  helpers compartidos en `data/shared.ts`.
- Mappers `rowTo*` se quedan junto al dominio que conoce esa tabla.
- Código de Storage va en `data/documents.ts`, no mezclado con viajes/clientes.
- Agregados de lectura para widgets viven en `data/dashboard.ts`; no deben
  crecer dentro de páginas.
- Antes de mover o partir funciones, fijar contratos con tests en
  `src/lib/__tests__/`.

## Estructura de carpetas relevantes

```
src/
  app/
    dashboard/              -- área autenticada (agente)
      page.tsx               lista de clientes y viajes
      clients/[id]/          ficha de cliente (ver/editar, historial de viajes)
      trips/new/              alta de viaje (+ cliente nuevo o existente)
      trips/[id]/              editor de viaje: días, items, publicar
    t/[slug]/               -- vista pública del viaje (sin auth)
    login/                  -- login del agente
  components/               -- componentes reutilizables (dialogs, combobox,
                               botones de calendario/QR/mapa)
  lib/
    data.ts                 -- fachada pública; solo reexporta src/lib/data/*
    data/
      shared.ts              helpers comunes, paginación, mock/Supabase switch
      clients.ts             clientes, tags, cumpleaños, referidos
      suppliers.ts           proveedores
      trips.ts               viajes, días, items, templates, packing, reminders
      documents.ts           documentos, fotos, portadas, logos, storage
      dashboard.ts           agregados para dashboard
      settings.ts            configuración del sitio
      feedback.ts            feedback de viajes
    mock-data.ts            -- datos de prueba en memoria
    supabase/
      client.ts               cliente de Supabase para el browser
      server.ts                cliente de Supabase para Server Components/Actions
    observability/
      whatsapp-ai.ts           eventos, sanitización y métricas WhatsApp/IA
    ics.ts                  -- generación de archivos .ics
    item-meta.ts             -- labels/iconos por tipo de item, formateo de fechas
  types/index.ts            -- tipos de dominio (Client, Trip, TripDay, Item, ...)
  middleware.ts              -- protección de /dashboard/**

supabase/
  migrations/                -- SQL versionado: schema, políticas RLS, bucket de storage
```

## Modelo de datos (resumen)

`clients` → `trips` → `trip_days` → `items` → `documents`

Esquema completo y políticas de RLS en `supabase/migrations/0001_init.sql`
(schema + RLS inicial), `0002_storage_bucket.sql` (bucket de documentos),
`0003_rls_harden.sql` (hardening adicional). Cada migración tiene comentarios
SQL explicando qué política hace qué — es la fuente de verdad del modelo de
datos, no la repitas de memoria en otro documento.

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

Ver `SUPABASE_SETUP.md` para el paso a paso de cómo obtener las keys. Variables
relevantes (`.env.local` en dev, configuradas en Vercel para producción):

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
  `mock-data.ts`; siempre atraviesan `@/lib/data`.
- La capa `src/lib/data/*` debe mantener funciones pequeñas por caso de uso y
  evitar mezclar UI, navegación, cookies o lógica de formularios.
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
