-- Soft delete para trip_days e items (issue #23).
--
-- Antes, "Eliminar día"/"Eliminar item" hacían un DELETE físico inmediato:
-- sin posibilidad de deshacer si el usuario se equivocaba de fila. Este
-- archivo agrega una columna deleted_at (marca de borrado, NULL = fila
-- activa) para que la app pueda "ocultar" la fila sin perder los datos, y
-- ofrecer un toast de "Deshacer" en la misma sesión.
--
-- No se agrega deleted_at a trips/clients/documents: fuera de alcance del
-- issue (solo trip_days/items, que es donde vive el flujo de edición del
-- itinerario con reordenar/editar/eliminar).

alter table trip_days add column if not exists deleted_at timestamptz;
alter table items add column if not exists deleted_at timestamptz;

-- Índices parciales: las consultas normales de la app siempre filtran por
-- deleted_at is null (día/items activos); un índice parcial cubre ese caso
-- sin cargar filas ya borradas al índice.
create index if not exists idx_trip_days_active on trip_days(trip_id) where deleted_at is null;
create index if not exists idx_items_active on items(trip_day_id) where deleted_at is null;

-- ============================================================
-- RLS: la lectura pública de /t/{slug} (trips.status = 'published') NO debe
-- mostrar días/items soft-deleted. Las políticas "_owner_all" (dueño
-- autenticado) NO se tocan: el dueño necesita seguir viendo/actualizando la
-- fila para poder deshacer el borrado (UPDATE deleted_at = null).
-- ============================================================

drop policy if exists "trip_days_public_read_published" on trip_days;
create policy "trip_days_public_read_published" on trip_days
  for select
  using (
    deleted_at is null
    and exists (
      select 1 from trips
      where trips.id = trip_days.trip_id
      and trips.status = 'published'
    )
  );

drop policy if exists "items_public_read_published" on items;
create policy "items_public_read_published" on items
  for select
  using (
    deleted_at is null
    and exists (
      select 1 from trip_days
      join trips on trips.id = trip_days.trip_id
      where trip_days.id = items.trip_day_id
      and trips.status = 'published'
    )
  );

-- documents: si el item que lo contiene está soft-deleted, el documento
-- tampoco debe ser visible públicamente (defensa en profundidad, aunque hoy
-- la UI pública no muestra documentos ligados a un item borrado porque el
-- item ya no aparece en la respuesta de items_public_read_published).
drop policy if exists "documents_public_read_published" on documents;
create policy "documents_public_read_published" on documents
  for select
  using (
    exists (
      select 1 from items
      join trip_days on trip_days.id = items.trip_day_id
      join trips on trips.id = trip_days.trip_id
      where items.id = documents.item_id
      and items.deleted_at is null
      and trip_days.deleted_at is null
      and trips.status = 'published'
    )
  );
