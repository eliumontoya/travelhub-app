-- TravelHub schema: mono-usuario (un solo agente/dueño autenticado).
-- Habilita extensión para gen_random_uuid().
create extension if not exists "pgcrypto";

-- ============================================================
-- Tablas
-- ============================================================

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  title text not null,
  slug text not null unique,
  start_date date,
  end_date date,
  cover_image_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz default now()
);

create table if not exists trip_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  date date not null,
  notes text,
  sort_order int not null default 0
);

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  trip_day_id uuid not null references trip_days(id) on delete cascade,
  type text not null,
  title text not null,
  start_time time,
  end_time time,
  location text,
  lat numeric,
  lng numeric,
  confirmation_code text,
  notes text,
  sort_order int not null default 0
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  file_url text not null,
  file_name text not null,
  uploaded_at timestamptz default now()
);

-- ============================================================
-- Índices razonables para las consultas frecuentes
-- ============================================================

create index if not exists idx_trips_client_id on trips(client_id);
create index if not exists idx_trips_slug on trips(slug);
create index if not exists idx_trips_status on trips(status);
create index if not exists idx_trip_days_trip_id on trip_days(trip_id);
create index if not exists idx_items_trip_day_id on items(trip_day_id);
create index if not exists idx_documents_item_id on documents(item_id);

-- ============================================================
-- Row Level Security
-- ============================================================
-- App mono-usuario: el único usuario autenticado (creado a mano en Supabase
-- Auth, ver SUPABASE_SETUP.md) es dueño de todo. Cualquier sesión autenticada
-- (auth.uid() is not null) puede leer y escribir todas las filas.
-- Además, se expone una política de SOLO LECTURA sin autenticación para
-- soportar la vista pública /t/{slug}, pero limitada a viajes publicados
-- (status = 'published') y a las filas hijas (days/items/documents) que
-- cuelgan de un viaje publicado.

alter table clients enable row level security;
alter table trips enable row level security;
alter table trip_days enable row level security;
alter table items enable row level security;
alter table documents enable row level security;

-- clients: solo el dueño autenticado puede leer/escribir. Los clientes nunca
-- se exponen públicamente (la vista /t/{slug} no debe mostrar datos del cliente).
create policy "clients_owner_all" on clients
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- trips: el dueño autenticado tiene acceso total.
create policy "trips_owner_all" on trips
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- trips: lectura pública (sin login) SOLO de viajes publicados, para /t/{slug}.
create policy "trips_public_read_published" on trips
  for select
  using (status = 'published');

-- trip_days: el dueño autenticado tiene acceso total.
create policy "trip_days_owner_all" on trip_days
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- trip_days: lectura pública solo si el trip padre está publicado.
create policy "trip_days_public_read_published" on trip_days
  for select
  using (
    exists (
      select 1 from trips
      where trips.id = trip_days.trip_id
      and trips.status = 'published'
    )
  );

-- items: el dueño autenticado tiene acceso total.
create policy "items_owner_all" on items
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- items: lectura pública solo si el trip (vía trip_day) está publicado.
create policy "items_public_read_published" on items
  for select
  using (
    exists (
      select 1 from trip_days
      join trips on trips.id = trip_days.trip_id
      where trip_days.id = items.trip_day_id
      and trips.status = 'published'
    )
  );

-- documents: el dueño autenticado tiene acceso total.
create policy "documents_owner_all" on documents
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- documents: lectura pública solo si el trip (vía item -> trip_day) está
-- publicado. Nota: file_url apunta a Storage privado; el bucket tiene sus
-- propias políticas (ver storage.objects más abajo / Sprint 3).
create policy "documents_public_read_published" on documents
  for select
  using (
    exists (
      select 1 from items
      join trip_days on trip_days.id = items.trip_day_id
      join trips on trips.id = trip_days.trip_id
      where items.id = documents.item_id
      and trips.status = 'published'
    )
  );
