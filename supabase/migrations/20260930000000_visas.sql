-- Visas domain: top-level visa applications separate from trips.
-- Tables, RLS, private storage bucket, and backfill for the many-to-many
-- client assignment mirror.

create table if not exists visas (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  country text not null,
  visa_type text not null,
  deadline date not null,
  price numeric(12,2) not null,
  notes text,
  status text not null default 'pending'
    check (status in ('pending','in_progress','completed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists visa_clients (
  visa_id uuid not null references visas(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (visa_id, client_id)
);

create index if not exists idx_visa_clients_client_id on visa_clients(client_id);

create table if not exists visa_status_history (
  id uuid primary key default gen_random_uuid(),
  visa_id uuid not null references visas(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_at timestamptz not null default now()
);

create index if not exists idx_visa_status_history_visa_id on visa_status_history(visa_id);

create table if not exists visa_documents (
  id uuid primary key default gen_random_uuid(),
  visa_id uuid not null references visas(id) on delete cascade,
  target_client_id uuid references clients(id) on delete set null,
  description text,
  file_path text,
  filename text,
  mime_type text,
  status text not null default 'uploaded'
    check (status in ('requested','uploaded','reviewed','processed','re_upload_requested')),
  agent_comment text,
  uploaded_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_visa_documents_visa_id on visa_documents(visa_id);
create index if not exists idx_visa_documents_target_client_id on visa_documents(target_client_id);

-- Row Level Security: mono-user authenticated pattern.
alter table visas enable row level security;
alter table visas force row level security;
alter table visa_clients enable row level security;
alter table visa_clients force row level security;
alter table visa_status_history enable row level security;
alter table visa_status_history force row level security;
alter table visa_documents enable row level security;
alter table visa_documents force row level security;

drop policy if exists "visas_authenticated_all" on visas;
create policy "visas_authenticated_all" on visas
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "visa_clients_authenticated_all" on visa_clients;
create policy "visa_clients_authenticated_all" on visa_clients
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "visa_status_history_authenticated_all" on visa_status_history;
create policy "visa_status_history_authenticated_all" on visa_status_history
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "visa_documents_authenticated_all" on visa_documents;
create policy "visa_documents_authenticated_all" on visa_documents
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

revoke all on visas from anon;
revoke all on visas from authenticated;
grant select, insert, update, delete on visas to authenticated;

revoke all on visa_clients from anon;
revoke all on visa_clients from authenticated;
grant select, insert, update, delete on visa_clients to authenticated;

revoke all on visa_status_history from anon;
revoke all on visa_status_history from authenticated;
grant select, insert, update, delete on visa_status_history to authenticated;

revoke all on visa_documents from anon;
revoke all on visa_documents from authenticated;
grant select, insert, update, delete on visa_documents to authenticated;

-- Private storage bucket for visa documents; server-side access only.
insert into storage.buckets (id, name, public)
values ('visa-documents', 'visa-documents', false)
on conflict (id) do nothing;

drop policy if exists "visa_documents_storage_authenticated_all" on storage.objects;
create policy "visa_documents_storage_authenticated_all" on storage.objects
  for all
  using (bucket_id = 'visa-documents' and auth.uid() is not null)
  with check (bucket_id = 'visa-documents' and auth.uid() is not null);

-- Backfill client assignments from the compatibility mirror column.
-- Idempotent so the migration can be re-run safely.
insert into visa_clients (visa_id, client_id)
select id, client_id from visas where client_id is not null
on conflict (visa_id, client_id) do nothing;
