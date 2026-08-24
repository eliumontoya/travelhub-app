-- Documentos globales del viaje (no atados a un item específico). Reutiliza el
-- bucket privado "trip-documents" (ver 0002_storage_bucket.sql), guardando los
-- objetos bajo el prefijo "trips/{tripId}/..." para no chocar con los paths de
-- documentos de item ("{itemId}/...") ni de cliente ("clients/{clientId}/...").

create table if not exists trip_documents (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  file_path text not null,
  filename text not null,
  mime_type text,
  created_at timestamptz default now()
);

create index if not exists idx_trip_documents_trip_id on trip_documents(trip_id);

alter table trip_documents enable row level security;
alter table trip_documents force row level security;

-- Dueño autenticado: acceso total (mismo modelo mono-usuario que el resto).
create policy "trip_documents_owner_all" on trip_documents
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- Lectura pública solo si el trip está publicado (join trip_documents -> trips).
-- file_path apunta a Storage privado; el bucket tiene sus propias políticas.
create policy "trip_documents_public_read_published" on trip_documents
  for select
  using (
    exists (
      select 1 from trips
      where trips.id = trip_documents.trip_id
        and trips.status = 'published'
    )
  );

revoke all on trip_documents from anon;
revoke all on trip_documents from authenticated;
grant select, insert, update, delete on trip_documents to authenticated;
grant select on trip_documents to anon;
