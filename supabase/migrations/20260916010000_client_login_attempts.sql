-- Per-email failed login attempt tracking for client PIN login (issue #302).
-- Sliding-window rate limiting; success resets the counter.
-- Accessed only through the service-role client, so RLS is enabled without
-- anonymous policies.

create table if not exists client_login_attempts (
  email text primary key,
  failures int not null default 0,
  window_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Row Level Security: owner-only, no anonymous access.
alter table client_login_attempts enable row level security;
alter table client_login_attempts force row level security;

create policy "client_login_attempts_owner_all" on client_login_attempts
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

revoke all on client_login_attempts from anon;
revoke all on client_login_attempts from authenticated;
grant select, insert, update, delete on client_login_attempts to authenticated;
