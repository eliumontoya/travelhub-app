-- Travel agents catalog + optional single-agent assignment per trip (issue #294).
-- Additive only: no column drops or renames.

-- Catalog of travel agents. Monousuario: RLS allows full CRUD to the authenticated owner.
create table if not exists travel_agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Case-insensitive unique name (matches tags_name_lower_key pattern).
create unique index if not exists travel_agents_name_lower_key on travel_agents (lower(name));

-- Optional single-agent assignment on trips. ON DELETE SET NULL keeps trips
-- valid when their assigned agent is removed; no reference-count guard.
alter table trips
  add column if not exists assigned_agent_id uuid references travel_agents(id) on delete set null;

create index if not exists idx_trips_assigned_agent_id on trips(assigned_agent_id);

-- Row Level Security: owner-only, no anonymous access.
alter table travel_agents enable row level security;
alter table travel_agents force row level security;

create policy "travel_agents_owner_all" on travel_agents
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

revoke all on travel_agents from anon;
revoke all on travel_agents from authenticated;
grant select, insert, update, delete on travel_agents to authenticated;
