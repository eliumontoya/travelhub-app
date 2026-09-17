-- Account profiles: role source for admin vs agent accounts (issue #300).
-- Additive only: creates the profiles table and role-aware RLS.
-- Application writes are intentionally out of scope; rows are provisioned manually.

-- Dedicated table separating Auth (Supabase) from authorization (app role).
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'agent')),
  features text[] not null default '{}',
  travel_agent_id uuid references travel_agents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Optional: admins can read other profiles; self-read is enforced by RLS.
create index if not exists idx_profiles_role on profiles(role);
create index if not exists idx_profiles_travel_agent_id on profiles(travel_agent_id);

-- Row Level Security: users read their own profile; admins read all profiles.
alter table profiles enable row level security;
alter table profiles force row level security;

-- Self-read: every authenticated user can read their own profile row.
create policy "profiles_self_read" on profiles
  for select
  using (auth.uid() = id);

-- Admin-read-all: an admin account can read every profile (for provisioning/management).
create policy "profiles_admin_read_all" on profiles
  for select
  using (
    exists (
      select 1 from profiles admin_profile
      where admin_profile.id = auth.uid() and admin_profile.role = 'admin'
    )
  );

-- No application write policies: provisioning is a manual operational step.
revoke all on profiles from anon;
revoke all on profiles from authenticated;
grant select on profiles to authenticated;

comment on table profiles is 'App-side authorization profiles for Supabase Auth users. Populated manually; no app writes.';
comment on column profiles.role is 'admin = full access; agent = feature-level access';
comment on column profiles.features is 'Feature flags for agent accounts; ignored for admins.';
comment on column profiles.travel_agent_id is 'Links an agent account to its travel_agents catalog entry.';
