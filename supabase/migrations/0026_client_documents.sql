-- Documentos a nivel cliente (pasaporte, identificación, etc.), no atados a
-- ningún viaje en particular. Reutiliza el bucket privado "trip-documents"
-- (ver 0002_storage_bucket.sql), guardando los objetos bajo el prefijo
-- "clients/{clientId}/..." para no chocar con los paths de documentos de
-- item ("{itemId}/...").

create table if not exists client_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  file_path text not null,
  filename text not null,
  mime_type text,
  created_at timestamptz default now()
);

create index if not exists idx_client_documents_client_id on client_documents(client_id);

-- Mismo modelo mono-usuario que el resto del esquema: solo el dueño
-- autenticado tiene acceso. A diferencia de documents (que sí tiene lectura
-- pública si el trip está publicado), client_documents NUNCA se expone -
-- son documentos internos del agente (pasaporte/identificación del cliente),
-- no deben verse desde /t/{slug} bajo ninguna circunstancia.
alter table client_documents enable row level security;
alter table client_documents force row level security;

create policy "client_documents_owner_all" on client_documents
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

revoke all on client_documents from anon;
revoke all on client_documents from authenticated;
grant select, insert, update, delete on client_documents to authenticated;
