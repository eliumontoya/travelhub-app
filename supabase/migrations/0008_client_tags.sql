-- Etiquetas/segmentos por cliente, 0..N (issue #56).
--
-- Reusa el catálogo global `tags` ya creado en 0007_trip_tags.sql (mismo
-- concepto que trip_tags, aplicado ahora a clients). NO se crea una tabla ni
-- un tipo de tags paralelo: solo la tabla puente client_tags many-to-many.
-- Igual que trip_tags, un cliente puede tener 0 tags: no hay regla de mínimo.

create table if not exists client_tags (
  client_id uuid not null references clients(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, tag_id)
);

-- La PK compuesta (client_id, tag_id) ya cubre la búsqueda hacia adelante
-- (cliente -> tags) por ser client_id la columna líder. Se agrega índice
-- explícito para la búsqueda inversa (tag -> clientes).
create index if not exists idx_client_tags_tag_id on client_tags(tag_id);

-- ============================================================
-- Row Level Security (mismo patrón que trip_tags_owner_all / clients)
-- ============================================================
-- Sin exposición pública/anónima, consistente con clients (0003_rls_harden.sql)
-- y trip_tags: la vista pública /t/[slug] no expone clientes ni sus tags.

alter table client_tags enable row level security;
alter table client_tags force row level security;

create policy "client_tags_owner_all" on client_tags
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

revoke all on client_tags from anon;
revoke all on client_tags from authenticated;
grant select, insert, update, delete on client_tags to authenticated;

-- Nota: sin backfill. Feature nueva, sin datos previos de client_tags.
