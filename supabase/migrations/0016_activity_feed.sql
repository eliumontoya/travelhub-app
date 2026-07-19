-- Soporte para el feed de actividad reciente del dashboard (issue #36):
-- agrega updated_at a clients y trips y lo mantiene al día con un trigger,
-- ya que created_at por sí solo no refleja ediciones posteriores.

alter table clients add column if not exists updated_at timestamptz default now();
alter table trips add column if not exists updated_at timestamptz default now();

update clients set updated_at = created_at where updated_at is null;
update trips set updated_at = created_at where updated_at is null;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists clients_set_updated_at on clients;
create trigger clients_set_updated_at
  before update on clients
  for each row execute function set_updated_at();

drop trigger if exists trips_set_updated_at on trips;
create trigger trips_set_updated_at
  before update on trips
  for each row execute function set_updated_at();
