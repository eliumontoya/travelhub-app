-- Relación many-to-many entre trips y clients (issue #4).
--
-- Hoy trips.client_id referencia un único cliente. Este cambio agrega una
-- tabla puente trip_clients que permite asignar 2+ clientes a un mismo viaje,
-- manteniendo trips.client_id como espejo de compatibilidad (primer cliente
-- asignado) para no romper lecturas existentes durante la transición.
--
-- trip_clients es la fuente de verdad para lecturas de "clientes asignados".

create table if not exists trip_clients (
  trip_id uuid not null references trips(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (trip_id, client_id)
);

-- La PK compuesta (trip_id, client_id) ya cubre la búsqueda hacia adelante
-- (trip -> clientes) por ser trip_id la columna líder. Se agrega índice
-- explícito para la búsqueda inversa (cliente -> viajes).
create index if not exists idx_trip_clients_client_id on trip_clients(client_id);

-- ============================================================
-- Row Level Security (mismo patrón que clients_owner_all / trips_owner_all)
-- ============================================================
-- Ningún dato de cliente se expone públicamente hoy (ver 0001_init.sql /
-- 0003_rls_harden.sql); trip_clients tampoco tiene política de lectura
-- anónima, consistente con clients.

alter table trip_clients enable row level security;
alter table trip_clients force row level security;

drop policy if exists "trip_clients_owner_all" on trip_clients;
create policy "trip_clients_owner_all" on trip_clients
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

revoke all on trip_clients from anon;
revoke all on trip_clients from authenticated;

grant select, insert, update, delete on trip_clients to authenticated;
-- Nota: NO se otorga ningún privilegio a "anon" (mirando la postura de
-- "clients" en 0003_rls_harden.sql: sin exposición pública de clientes).

-- ============================================================
-- Backfill: un row en trip_clients por cada trip existente con client_id.
-- Idempotente (ON CONFLICT DO NOTHING) para poder re-ejecutar sin duplicar.
-- ============================================================

insert into trip_clients (trip_id, client_id)
select id, client_id from trips where client_id is not null
on conflict (trip_id, client_id) do nothing;

-- ============================================================
-- Defusa trips.client_id: de espejo NOT NULL + ON DELETE CASCADE a espejo
-- NULLABLE + ON DELETE SET NULL.
--
-- CRÍTICO: hoy trips.client_id references clients(id) on delete cascade.
-- Si se mantuviera esa FK, borrar UN solo cliente asignado a un viaje
-- compartido borraría el viaje completo para TODOS los clientes asignados
-- (pérdida de datos). Cambiar a ON DELETE SET NULL neutraliza esto: borrar
-- un cliente solo elimina sus filas en trip_clients (que sí mantienen
-- cascade), nunca el viaje.
--
-- El nombre de constraint asumido `trips_client_id_fkey` es el nombre por
-- default de Postgres para una FK inline sin nombre explícito, confirmado
-- contra 0001_init.sql (columna client_id definida sin `constraint <name>`).
-- ============================================================

alter table trips alter column client_id drop not null;
alter table trips drop constraint if exists trips_client_id_fkey;
alter table trips
  add constraint trips_client_id_fkey
  foreign key (client_id) references clients(id) on delete set null;

-- No se elimina ninguna columna (no DROP COLUMN); idx_trips_client_id de
-- 0001_init.sql permanece intacto.
