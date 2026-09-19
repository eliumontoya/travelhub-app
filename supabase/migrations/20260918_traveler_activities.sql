-- Traveler-created itinerary activities. Existing and agent-created items keep
-- NULL attribution; traveler writes use the service-role RPCs below only.

alter table items
  add column if not exists created_by_client_id uuid
  references clients(id) on delete set null;

create index if not exists idx_items_created_by_client_id
  on items(created_by_client_id)
  where created_by_client_id is not null;

create or replace function create_traveler_activity(
  p_trip_id uuid,
  p_trip_day_id uuid,
  p_client_id uuid,
  p_title text,
  p_start_time time,
  p_location text,
  p_notes text
) returns items
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_trip trips%rowtype;
  v_day trip_days%rowtype;
  v_item items%rowtype;
  v_sort_order integer;
begin
  select * into v_trip from trips where id = p_trip_id for update;
  if not found or v_trip.status <> 'published' then
    raise exception 'traveler activity unauthorized' using errcode = '42501';
  end if;

  perform 1 from trip_clients
    where trip_id = p_trip_id and client_id = p_client_id
    for key share;
  if not found then
    raise exception 'traveler activity unauthorized' using errcode = '42501';
  end if;

  select * into v_day from trip_days
    where id = p_trip_day_id and trip_id = p_trip_id and deleted_at is null
    for update;
  if not found then
    raise exception 'traveler activity unauthorized' using errcode = '42501';
  end if;

  if p_title is null or char_length(btrim(p_title)) = 0 or char_length(btrim(p_title)) > 120
    or char_length(coalesce(p_location, '')) > 200
    or char_length(coalesce(p_notes, '')) > 2000 then
    raise exception 'traveler activity invalid' using errcode = '22023';
  end if;

  select coalesce(max(sort_order) + 1, 0) into v_sort_order
    from items where trip_day_id = p_trip_day_id and deleted_at is null;

  insert into items (
    trip_day_id, created_by_client_id, type, title, start_time, location, notes, sort_order, item_metadata
  ) values (
    p_trip_day_id, p_client_id, 'activity', btrim(p_title), p_start_time, nullif(btrim(p_location), ''),
    nullif(p_notes, ''), v_sort_order, null
  ) returning * into v_item;

  return v_item;
end;
$$;

create or replace function update_traveler_activity(
  p_trip_id uuid,
  p_trip_day_id uuid,
  p_client_id uuid,
  p_item_id uuid,
  p_title text,
  p_start_time time,
  p_location text,
  p_notes text
) returns items
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_trip trips%rowtype;
  v_day trip_days%rowtype;
  v_item items%rowtype;
begin
  select * into v_trip from trips where id = p_trip_id for update;
  if not found or v_trip.status <> 'published' then
    raise exception 'traveler activity unauthorized' using errcode = '42501';
  end if;

  perform 1 from trip_clients
    where trip_id = p_trip_id and client_id = p_client_id
    for key share;
  if not found then
    raise exception 'traveler activity unauthorized' using errcode = '42501';
  end if;

  select * into v_day from trip_days
    where id = p_trip_day_id and trip_id = p_trip_id and deleted_at is null
    for update;
  if not found then
    raise exception 'traveler activity unauthorized' using errcode = '42501';
  end if;

  if p_title is null or char_length(btrim(p_title)) = 0 or char_length(btrim(p_title)) > 120
    or char_length(coalesce(p_location, '')) > 200
    or char_length(coalesce(p_notes, '')) > 2000 then
    raise exception 'traveler activity invalid' using errcode = '22023';
  end if;

  select * into v_item from items
    where id = p_item_id
      and trip_day_id = p_trip_day_id
      and type = 'activity'
      and created_by_client_id = p_client_id
      and deleted_at is null
    for update;
  if not found then
    raise exception 'traveler activity unauthorized' using errcode = '42501';
  end if;

  update items set
    title = btrim(p_title),
    start_time = p_start_time,
    location = nullif(btrim(p_location), ''),
    notes = nullif(p_notes, '')
  where id = p_item_id
  returning * into v_item;

  return v_item;
end;
$$;

create or replace function soft_delete_traveler_activity(
  p_trip_id uuid,
  p_trip_day_id uuid,
  p_client_id uuid,
  p_item_id uuid
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_trip trips%rowtype;
  v_day trip_days%rowtype;
begin
  select * into v_trip from trips where id = p_trip_id for update;
  if not found or v_trip.status <> 'published' then
    raise exception 'traveler activity unauthorized' using errcode = '42501';
  end if;

  perform 1 from trip_clients
    where trip_id = p_trip_id and client_id = p_client_id
    for key share;
  if not found then
    raise exception 'traveler activity unauthorized' using errcode = '42501';
  end if;

  select * into v_day from trip_days
    where id = p_trip_day_id and trip_id = p_trip_id and deleted_at is null
    for update;
  if not found then
    raise exception 'traveler activity unauthorized' using errcode = '42501';
  end if;

  update items set deleted_at = now()
    where id = p_item_id
      and trip_day_id = p_trip_day_id
      and type = 'activity'
      and created_by_client_id = p_client_id
      and deleted_at is null;
  if not found then
    raise exception 'traveler activity unauthorized' using errcode = '42501';
  end if;
end;
$$;

revoke all on function create_traveler_activity(uuid, uuid, uuid, text, time, text, text)
  from public, anon, authenticated;
revoke all on function update_traveler_activity(uuid, uuid, uuid, uuid, text, time, text, text)
  from public, anon, authenticated;
revoke all on function soft_delete_traveler_activity(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function create_traveler_activity(uuid, uuid, uuid, text, time, text, text) to service_role;
grant execute on function update_traveler_activity(uuid, uuid, uuid, uuid, text, time, text, text) to service_role;
grant execute on function soft_delete_traveler_activity(uuid, uuid, uuid, uuid) to service_role;
