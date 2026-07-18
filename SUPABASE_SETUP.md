# Configurar Supabase para TravelHub

TravelHub funciona sin Supabase (usa datos de prueba en memoria, ver
`src/lib/mock-data.ts` y `src/lib/data.ts`), pero para tener datos
persistentes, login real y upload de documentos necesitas un proyecto de
Supabase. Sigue estos pasos exactos.

## 1. Crear cuenta y proyecto en Supabase

1. Ve a https://supabase.com y crea una cuenta (o inicia sesión).
2. Click en "New project".
3. Elige una organización, ponle nombre al proyecto (ej. `travelhub`),
   genera una contraseña de base de datos (guárdala, la pedirás poco) y
   elige la región más cercana a ti.
4. Espera 1-2 minutos a que Supabase aprovisione el proyecto.

## 2. Correr la migración SQL

Tienes dos formas de correr las migraciones (`supabase/migrations/0001_init.sql`,
`0002_storage_bucket.sql`, `0003_rls_harden.sql`). La más simple sin instalar
nada:

1. En el dashboard del proyecto, ve a **SQL Editor** (barra lateral).
2. Click en "New query".
3. Abre `supabase/migrations/0001_init.sql` en este repo, copia todo el
   contenido, pégalo en el editor y dale **Run**.
4. Repite el mismo paso con `supabase/migrations/0002_storage_bucket.sql`.
5. Repite el mismo paso con `supabase/migrations/0003_rls_harden.sql`.

Corre los tres en ese orden (0001 → 0002 → 0003); cada uno depende de que el
anterior ya haya corrido.

Alternativa con Supabase CLI (si ya la tienes instalada):

```bash
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase db push
```

`TU_PROJECT_REF` está en la URL del proyecto o en Project Settings > General.

## 3. Confirmar que el bucket de Storage se creó

La migración `0002_storage_bucket.sql` crea el bucket `trip-documents` vía
SQL. Verifícalo en **Storage** (barra lateral): debe aparecer un bucket
llamado `trip-documents` marcado como privado. Si por permisos la migración
no pudo crearlo, créalo a mano: Storage → "New bucket" → nombre
`trip-documents` → **Public bucket: OFF**.

## 4. Copiar las 3 keys a .env.local

1. En el dashboard, ve a **Project Settings → API**.
2. Copia:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** (sección "Project API keys", sensible, no
     exponer nunca al cliente) → `SUPABASE_SERVICE_ROLE_KEY`
3. En la raíz del proyecto, copia el archivo de ejemplo:

   ```bash
   cp .env.local.example .env.local
   ```

4. Abre `.env.local` y pega las 3 keys. Este archivo ya está en
   `.gitignore` (no se commitea).
5. Reinicia el servidor de desarrollo (`npm run dev`) para que Next.js
   recoja las variables nuevas.

## 5. Crear el único usuario admin

No hay registro público — es una app mono-usuario para un solo agente de
viajes. Crea tu usuario a mano:

1. En el dashboard, ve a **Authentication → Users**.
2. Click en "Add user" → "Create new user".
3. Pon tu email y una contraseña. Puedes marcar "Auto Confirm User" para no
   tener que confirmar por correo.
4. Con ese email/contraseña entra en `/login` de la app.

Con esto, `/dashboard/**` queda protegido por el middleware
(`src/middleware.ts`): sin sesión, redirige a `/login`.

## 6. (Opcional) Google Maps API key

Habilita autocomplete de ubicación en el formulario de items y el mapa
embebido en la vista pública. **Todo funciona sin esta key** (input de texto
plano sin autocomplete, y un link simple a Google Maps en vez de mapa
embebido), así que este paso es completamente opcional.

1. Ve a https://console.cloud.google.com/ y crea (o reusa) un proyecto.
2. Habilita las APIs **"Places API"** y **"Maps Embed API"**.
3. Ve a **APIs & Services → Credentials → Create Credentials → API key**.
4. Restringe la key a esas dos APIs y, si quieres, a tu dominio.
5. Pega la key en `.env.local` como `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
6. Reinicia `npm run dev`.

## Variables de entorno — resumen

| Variable | Obligatoria | Dónde se usa |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | No (fallback a mocks) | cliente y servidor |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No (fallback a mocks) | cliente y servidor |
| `SUPABASE_SERVICE_ROLE_KEY` | No (reservada, no usada por el código actual) | solo servidor, nunca exponer |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | No (fallback sin mapa/autocomplete) | cliente |

Nota: el código actual (`src/lib/supabase/*`, `src/lib/data.ts`) opera con
la **anon key** dentro de las políticas RLS del usuario autenticado — no
necesita la service role key para nada de lo implementado. Se deja
documentada por si en el futuro agregas un script administrativo que sí la
requiera (por ejemplo, un seed o una migración de datos que deba saltarse
RLS).
