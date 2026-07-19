-- Slug público de cliente para historial de viajes por cliente (issue #47).
--
-- Añade clients.slug (nullable, único). SIN backfill de clientes existentes:
-- solo se genera para clientes nuevos (ver generateClientSlug en
-- src/lib/data.ts, mismo slugify() que el slug de viajes).
--
-- Expone lectura pública MÍNIMA (id, slug, name — nunca email/phone/notes)
-- para un cliente que tenga al menos un viaje publicado, mismo patrón
-- "_public_read_published" que trips_public_read_published (0001_init.sql),
-- combinado con un GRANT a nivel de columna (no de tabla) para que, aunque
-- la fila pase RLS, "anon" solo pueda leer id/slug/name.
--
-- La condición usa trips.client_id (espejo de compatibilidad, ver
-- 0006_trip_clients.sql) en vez de trip_clients: trip_clients no tiene
-- ninguna política de lectura pública (por diseño explícito, ver comentario
-- en 0006_trip_clients.sql: "sin exposición pública de clientes") y darle
-- una rompería esa postura. trips.client_id ya es de lectura pública vía
-- trips_public_read_published, así que reusarlo aquí no abre ningún permiso
-- nuevo sobre trips/trip_clients.
--
-- Limitación conocida (documentada, no resuelta en este cambio): en un viaje
-- con 2+ clientes asignados (trip_clients), solo el primer cliente asignado
-- (trips.client_id espejo) verá ese viaje en /c/{slug}.

alter table clients add column if not exists slug text unique;

create index if not exists idx_clients_slug on clients(slug);

create policy "clients_public_read_published_trips" on clients
  for select
  using (
    exists (
      select 1 from trips
      where trips.client_id = clients.id
      and trips.status = 'published'
    )
  );

-- anon solo puede leer id/slug/name, incluso en filas que pasan la política
-- anterior: nunca email/phone/notes.
grant select (id, slug, name) on clients to anon;
