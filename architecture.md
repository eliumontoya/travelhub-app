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
   │      Server Components + Server Actions → src/lib/data.ts → Supabase
   │
   └── /t/{slug}      (público, sin login, para el cliente final)
          Server Component → src/lib/data.ts → Supabase (RLS: solo published)
```

- Todo el frontend y backend viven en la misma app Next.js — no hay un
  servidor API separado. Las mutaciones se hacen con **Server Actions**
  (`"use server"`), no con rutas API REST propias.
- `src/middleware.ts` protege todas las rutas bajo `/dashboard/**`,
  redirigiendo a `/login` si no hay sesión de Supabase.
- La vista pública (`/t/[slug]`) no requiere autenticación: se apoya en las
  políticas de Row Level Security de Postgres para exponer únicamente los
  viajes con `status = 'published'`.

## Capa de datos: modo dual mock/Supabase

`src/lib/data.ts` es el único punto de acceso a datos desde las páginas. Cada
función revisa `isSupabaseConfigured()` (definida en
`src/lib/supabase/server.ts`, verifica que las env vars de Supabase existan):

- **Si Supabase está configurado**: lee/escribe directo en Postgres.
- **Si no**: usa arrays en memoria de `src/lib/mock-data.ts` como fallback.

Esto permite levantar el proyecto y navegarlo sin cuenta de Supabase. Nunca
importar `mock-data.ts` directo desde una página — siempre pasar por
`data.ts`.

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
    data.ts                 -- capa de acceso a datos (mock ⟷ Supabase)
    mock-data.ts            -- datos de prueba en memoria
    supabase/
      client.ts               cliente de Supabase para el browser
      server.ts                cliente de Supabase para Server Components/Actions
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

## Entornos y variables

Ver `SUPABASE_SETUP.md` para el paso a paso de cómo obtener las keys. Variables
relevantes (`.env.local` en dev, configuradas en Vercel para producción):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — conexión pública a Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — uso server-side únicamente, nunca exponer al cliente
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — opcional, activa autocomplete de ubicación y mapa embebido

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
- Reordenar listas (días, items) usa botones ↑/↓ sobre `sort_order` —
  decisión deliberada de no usar librerías de drag-and-drop, dado el volumen
  de uso esperado.
- Toda feature que dependa de una API key externa (Supabase, Google
  Maps/Places) debe degradar con gracia si la key no está configurada, no
  debe requerirla para que la app funcione en modo básico.
