-- Feedback del cliente post-viaje (issue #46).
--
-- Tabla trip_feedback: calificación 1-5 + comentario opcional, enviado desde
-- la vista pública /t/{slug} una vez que el viaje ya terminó. El insert
-- público (rol anon, sin sesión) se permite solo si el trip referenciado
-- está publicado, mismo patrón que trips_public_read_published /
-- items_public_read_published en 0001_init.sql. A diferencia de esas
-- políticas, aquí no hay lectura pública: el feedback solo lo ve el dueño
-- autenticado en el editor de viaje.

create table if not exists trip_feedback (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists idx_trip_feedback_trip_id on trip_feedback(trip_id);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table trip_feedback enable row level security;
alter table trip_feedback force row level security;

-- Dueño autenticado: acceso total (lectura en el editor, y borrado manual si
-- hiciera falta moderar feedback).
create policy "trip_feedback_owner_all" on trip_feedback
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- anon: solo INSERT, y solo si el trip referenciado está publicado. Sin
-- política de SELECT para anon, por lo que un cliente no puede leer
-- feedback ajeno ni el suyo propio de vuelta.
create policy "trip_feedback_public_insert_published" on trip_feedback
  for insert
  to anon
  with check (
    exists (
      select 1 from trips
      where trips.id = trip_feedback.trip_id
      and trips.status = 'published'
    )
  );

revoke all on trip_feedback from anon;
revoke all on trip_feedback from authenticated;
grant insert on trip_feedback to anon;
grant select, insert, update, delete on trip_feedback to authenticated;
