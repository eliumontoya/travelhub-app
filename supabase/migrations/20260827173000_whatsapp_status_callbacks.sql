-- WhatsApp outbound delivery status callbacks (issue #217).
-- Status callbacks are private audit data processed by server-side service role.

alter table whatsapp_messages drop constraint if exists whatsapp_messages_status_check;
alter table whatsapp_messages
  add constraint whatsapp_messages_status_check
  check (status in ('received', 'processed', 'responded', 'escalated', 'failed', 'sent', 'delivered', 'read'));

create table if not exists whatsapp_message_status_callbacks (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references whatsapp_messages(id) on delete set null,
  whatsapp_message_id text not null,
  status text not null check (status in ('sent', 'delivered', 'read', 'failed')),
  recipient_phone text,
  occurred_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  callback_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_whatsapp_status_callbacks_message_id
  on whatsapp_message_status_callbacks(message_id);
create index if not exists idx_whatsapp_status_callbacks_whatsapp_message_id
  on whatsapp_message_status_callbacks(whatsapp_message_id);
create index if not exists idx_whatsapp_status_callbacks_status
  on whatsapp_message_status_callbacks(status);
create index if not exists idx_whatsapp_status_callbacks_occurred_at
  on whatsapp_message_status_callbacks(occurred_at desc);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'whatsapp_message_status_callbacks_set_updated_at'
  ) then
    create trigger whatsapp_message_status_callbacks_set_updated_at
      before update on whatsapp_message_status_callbacks
      for each row execute function set_updated_at();
  end if;
end $$;

alter table whatsapp_message_status_callbacks enable row level security;
alter table whatsapp_message_status_callbacks force row level security;

revoke all on whatsapp_message_status_callbacks from anon;
revoke all on whatsapp_message_status_callbacks from authenticated;
grant select, insert, update, delete on whatsapp_message_status_callbacks to authenticated;

drop policy if exists "whatsapp_status_callbacks_admin_all" on whatsapp_message_status_callbacks;
create policy "whatsapp_status_callbacks_admin_all" on whatsapp_message_status_callbacks
  for all to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);
