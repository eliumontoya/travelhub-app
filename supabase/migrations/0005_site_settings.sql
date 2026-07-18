-- Tabla singleton para el contacto público (email/teléfono) mostrado en el
-- hero de /t/[slug] y editable desde /dashboard/settings (issue #7).
create table if not exists site_settings (
  id int primary key default 1 check (id = 1),
  email text not null default '',
  phone text not null default '',
  updated_at timestamptz default now()
);

-- Semilla: exactamente una fila con los valores placeholder que antes vivían
-- en src/lib/site-config.ts, para que la tabla nunca esté vacía.
insert into site_settings (id, email, phone)
  values (1, 'contacto@example.com', '+52 000 000 0000')
  on conflict (id) do nothing;

alter table site_settings enable row level security;
alter table site_settings force row level security;

create policy "site_settings_owner_all" on site_settings
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "site_settings_public_read" on site_settings
  for select using (true);

revoke all on site_settings from anon;
revoke all on site_settings from authenticated;
grant select on site_settings to anon;
grant select, insert, update on site_settings to authenticated;
