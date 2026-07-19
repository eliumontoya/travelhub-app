-- Historial de transiciones de estado de un viaje (draft/published/archived),
-- issue #55. Cada cambio de status en trips genera una fila aquí; nunca se
-- actualiza ni borra una fila existente (append-only), así que no hace falta
-- updated_at ni soft-delete.

create table if not exists trip_status_history (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_at timestamptz not null default now()
);

create index if not exists idx_trip_status_history_trip_id on trip_status_history(trip_id);

-- ============================================================
-- Row Level Security (mismo patrón que trip_tags: sin exposición pública)
-- ============================================================

alter table trip_status_history enable row level security;
alter table trip_status_history force row level security;

create policy "trip_status_history_owner_all" on trip_status_history
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

revoke all on trip_status_history from anon;
revoke all on trip_status_history from authenticated;
grant select, insert, update, delete on trip_status_history to authenticated;

-- Nota: sin backfill. Feature nueva; no hay forma de reconstruir el historial
-- de transiciones pasadas de los viajes ya existentes.
