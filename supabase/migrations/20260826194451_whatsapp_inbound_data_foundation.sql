-- WhatsApp inbound automation and CRM sync staging foundation (issue #199).
-- Additive schema only: no webhook, LLM, orchestration, CRM processor, or UI.
-- Private by default: no anon grants; mono-admin access for authenticated users;
-- server-side automations use the Supabase service role key.

create table if not exists whatsapp_contacts (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null unique,
  whatsapp_profile_name text,
  display_name text,
  linked_client_id uuid references clients(id) on delete set null,
  source text not null default 'whatsapp',
  opt_in_status text not null default 'unknown'
    check (opt_in_status in ('unknown', 'pending', 'opted_in', 'opted_out')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references whatsapp_contacts(id) on delete cascade,
  assigned_trip_id uuid references trips(id) on delete set null,
  channel text not null default 'whatsapp' check (channel = 'whatsapp'),
  status text not null default 'open'
    check (status in ('open', 'awaiting_agent', 'escalated', 'resolved', 'archived')),
  last_intent text,
  last_message_at timestamptz,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references whatsapp_conversations(id) on delete cascade,
  contact_id uuid not null references whatsapp_contacts(id) on delete cascade,
  whatsapp_message_id text not null unique,
  direction text not null check (direction in ('inbound', 'outbound')),
  message_type text not null default 'text',
  body text,
  media jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received'
    check (status in ('received', 'processed', 'responded', 'escalated', 'failed', 'sent')),
  occurred_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists whatsapp_intents (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references whatsapp_conversations(id) on delete cascade,
  message_id uuid not null references whatsapp_messages(id) on delete cascade,
  contact_id uuid not null references whatsapp_contacts(id) on delete cascade,
  intent_type text not null default 'unknown'
    check (intent_type in ('inquiry', 'quote_request', 'existing_trip', 'support', 'handoff', 'unknown')),
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  entities jsonb not null default '{}'::jsonb,
  summary text,
  status text not null default 'detected'
    check (status in ('detected', 'confirmed', 'dismissed', 'synced')),
  detected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists whatsapp_escalations (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references whatsapp_conversations(id) on delete cascade,
  contact_id uuid not null references whatsapp_contacts(id) on delete cascade,
  message_id uuid references whatsapp_messages(id) on delete set null,
  intent_id uuid references whatsapp_intents(id) on delete set null,
  reason text not null,
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open'
    check (status in ('open', 'acknowledged', 'resolved', 'canceled')),
  summary text,
  assigned_to text,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists whatsapp_knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  question text not null,
  answer text not null,
  tags text[] not null default '{}',
  source text,
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'archived')),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists crm_sync_events (
  id uuid primary key default gen_random_uuid(),
  source_table text not null,
  source_id uuid not null,
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid,
  event_key text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'processed', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_whatsapp_contacts_linked_client_id on whatsapp_contacts(linked_client_id);
create index if not exists idx_whatsapp_contacts_last_message_at on whatsapp_contacts(last_message_at desc);

create index if not exists idx_whatsapp_conversations_contact_id on whatsapp_conversations(contact_id);
create index if not exists idx_whatsapp_conversations_assigned_trip_id on whatsapp_conversations(assigned_trip_id);
create index if not exists idx_whatsapp_conversations_status on whatsapp_conversations(status);
create index if not exists idx_whatsapp_conversations_last_message_at on whatsapp_conversations(last_message_at desc);

create index if not exists idx_whatsapp_messages_conversation_id on whatsapp_messages(conversation_id);
create index if not exists idx_whatsapp_messages_contact_id on whatsapp_messages(contact_id);
create index if not exists idx_whatsapp_messages_status on whatsapp_messages(status);
create index if not exists idx_whatsapp_messages_occurred_at on whatsapp_messages(occurred_at desc);

create index if not exists idx_whatsapp_intents_conversation_id on whatsapp_intents(conversation_id);
create index if not exists idx_whatsapp_intents_message_id on whatsapp_intents(message_id);
create index if not exists idx_whatsapp_intents_contact_id on whatsapp_intents(contact_id);
create index if not exists idx_whatsapp_intents_status on whatsapp_intents(status);
create index if not exists idx_whatsapp_intents_detected_at on whatsapp_intents(detected_at desc);

create index if not exists idx_whatsapp_escalations_conversation_id on whatsapp_escalations(conversation_id);
create index if not exists idx_whatsapp_escalations_contact_id on whatsapp_escalations(contact_id);
create index if not exists idx_whatsapp_escalations_status on whatsapp_escalations(status);
create index if not exists idx_whatsapp_escalations_opened_at on whatsapp_escalations(opened_at desc);

create index if not exists idx_whatsapp_knowledge_entries_status on whatsapp_knowledge_entries(status);
create index if not exists idx_whatsapp_knowledge_entries_topic on whatsapp_knowledge_entries(topic);
create index if not exists idx_whatsapp_knowledge_entries_tags on whatsapp_knowledge_entries using gin(tags);

create unique index if not exists idx_crm_sync_events_event_key
  on crm_sync_events(event_key)
  where event_key is not null;
create index if not exists idx_crm_sync_events_source on crm_sync_events(source_table, source_id);
create index if not exists idx_crm_sync_events_status on crm_sync_events(status);
create index if not exists idx_crm_sync_events_created_at on crm_sync_events(created_at desc);
create index if not exists idx_crm_sync_events_pending
  on crm_sync_events(available_at, created_at)
  where status = 'pending';

create trigger whatsapp_contacts_set_updated_at
  before update on whatsapp_contacts
  for each row execute function set_updated_at();

create trigger whatsapp_conversations_set_updated_at
  before update on whatsapp_conversations
  for each row execute function set_updated_at();

create trigger whatsapp_intents_set_updated_at
  before update on whatsapp_intents
  for each row execute function set_updated_at();

create trigger whatsapp_escalations_set_updated_at
  before update on whatsapp_escalations
  for each row execute function set_updated_at();

create trigger whatsapp_knowledge_entries_set_updated_at
  before update on whatsapp_knowledge_entries
  for each row execute function set_updated_at();

create trigger crm_sync_events_set_updated_at
  before update on crm_sync_events
  for each row execute function set_updated_at();

alter table whatsapp_contacts enable row level security;
alter table whatsapp_contacts force row level security;
alter table whatsapp_conversations enable row level security;
alter table whatsapp_conversations force row level security;
alter table whatsapp_messages enable row level security;
alter table whatsapp_messages force row level security;
alter table whatsapp_intents enable row level security;
alter table whatsapp_intents force row level security;
alter table whatsapp_escalations enable row level security;
alter table whatsapp_escalations force row level security;
alter table whatsapp_knowledge_entries enable row level security;
alter table whatsapp_knowledge_entries force row level security;
alter table crm_sync_events enable row level security;
alter table crm_sync_events force row level security;

revoke all on whatsapp_contacts from anon;
revoke all on whatsapp_contacts from authenticated;
revoke all on whatsapp_conversations from anon;
revoke all on whatsapp_conversations from authenticated;
revoke all on whatsapp_messages from anon;
revoke all on whatsapp_messages from authenticated;
revoke all on whatsapp_intents from anon;
revoke all on whatsapp_intents from authenticated;
revoke all on whatsapp_escalations from anon;
revoke all on whatsapp_escalations from authenticated;
revoke all on whatsapp_knowledge_entries from anon;
revoke all on whatsapp_knowledge_entries from authenticated;
revoke all on crm_sync_events from anon;
revoke all on crm_sync_events from authenticated;

grant select, insert, update, delete on whatsapp_contacts to authenticated;
grant select, insert, update, delete on whatsapp_conversations to authenticated;
grant select, insert, update, delete on whatsapp_messages to authenticated;
grant select, insert, update, delete on whatsapp_intents to authenticated;
grant select, insert, update, delete on whatsapp_escalations to authenticated;
grant select, insert, update, delete on whatsapp_knowledge_entries to authenticated;
grant select, insert, update, delete on crm_sync_events to authenticated;

create policy "whatsapp_contacts_admin_all" on whatsapp_contacts
  for all to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

create policy "whatsapp_conversations_admin_all" on whatsapp_conversations
  for all to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

create policy "whatsapp_messages_admin_all" on whatsapp_messages
  for all to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

create policy "whatsapp_intents_admin_all" on whatsapp_intents
  for all to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

create policy "whatsapp_escalations_admin_all" on whatsapp_escalations
  for all to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

create policy "whatsapp_knowledge_entries_admin_all" on whatsapp_knowledge_entries
  for all to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

create policy "crm_sync_events_admin_all" on crm_sync_events
  for all to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);
