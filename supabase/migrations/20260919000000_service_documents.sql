-- Servicios por (viaje, cliente): contenedor de checklist y uploads de
-- documentos. Reutiliza el bucket privado "trip-documents"
-- (ver 0002_storage_bucket.sql) bajo el prefijo
-- "services/{serviceId}/{checklistItemId}/...".
--
-- Modelo mono-usuario autenticado: solo el dueño autenticado tiene acceso,
-- igual que client_documents (ver 0026_client_documents.sql). Los clientes
-- finales no tienen identidad de Supabase Auth, por lo que todas las
-- lecturas/escrituras del portal pasan por Server Actions con service role.

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  service_type text not null default 'trip_documents',
  status text not null default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (trip_id, client_id, service_type)
);

create table if not exists service_checklist_items (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services(id) on delete cascade,
  label text not null,
  required boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists service_uploads (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services(id) on delete cascade,
  checklist_item_id uuid not null references service_checklist_items(id) on delete cascade,
  file_path text not null,
  filename text not null,
  mime_type text,
  status text not null default 'uploaded',
  agent_comment text,
  file_removed boolean not null default false,
  uploaded_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (service_id, checklist_item_id)
);

create index if not exists idx_services_trip_id on services(trip_id);
create index if not exists idx_services_client_id on services(client_id);
create index if not exists idx_service_checklist_items_service_id on service_checklist_items(service_id);
create index if not exists idx_service_uploads_service_id on service_uploads(service_id);
create index if not exists idx_service_uploads_checklist_item_id on service_uploads(checklist_item_id);

-- RLS: solo usuarios autenticados (service role del agente / Server Actions).
alter table services enable row level security;
alter table services force row level security;
alter table service_checklist_items enable row level security;
alter table service_checklist_items force row level security;
alter table service_uploads enable row level security;
alter table service_uploads force row level security;

create policy "services_authenticated_all" on services
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "service_checklist_items_authenticated_all" on service_checklist_items
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "service_uploads_authenticated_all" on service_uploads
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

revoke all on services from anon;
revoke all on services from authenticated;
grant select, insert, update, delete on services to authenticated;

revoke all on service_checklist_items from anon;
revoke all on service_checklist_items from authenticated;
grant select, insert, update, delete on service_checklist_items to authenticated;

revoke all on service_uploads from anon;
revoke all on service_uploads from authenticated;
grant select, insert, update, delete on service_uploads to authenticated;
