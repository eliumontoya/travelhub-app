-- Deterministic WCC contact-to-client linking (issue #253).
-- The relationship is owned by the database so webhook ingestion, client edits,
-- imports, and WCC all observe the same persisted linked_client_id.

alter table whatsapp_contacts
  add column if not exists linked_client_source text;

alter table whatsapp_contacts
  add column if not exists linked_client_matched_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'whatsapp_contacts_linked_client_source_check'
      and conrelid = 'public.whatsapp_contacts'::regclass
  ) then
    alter table whatsapp_contacts
      add constraint whatsapp_contacts_linked_client_source_check
      check (linked_client_source is null or linked_client_source in ('auto_phone', 'manual'));
  end if;
end $$;

create or replace function normalize_whatsapp_phone(phone text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '')
$$;

create or replace function resolve_whatsapp_contact_client_id(phone text)
returns uuid
language plpgsql
stable
as $$
declare
  normalized_phone text := normalize_whatsapp_phone(phone);
  matched_client_id uuid;
  match_count integer;
begin
  if normalized_phone is null then
    return null;
  end if;

  select count(*), (array_agg(id))[1]
    into match_count, matched_client_id
  from clients
  where whatsapp_normalized = normalized_phone;

  if match_count = 1 then
    return matched_client_id;
  end if;

  return null;
end;
$$;

create or replace function set_whatsapp_contact_linked_client()
returns trigger
language plpgsql
as $$
declare
  matched_client_id uuid;
begin
  if new.linked_client_id is not null
     and coalesce(new.linked_client_source, 'manual') <> 'auto_phone' then
    new.linked_client_source := coalesce(new.linked_client_source, 'manual');
    return new;
  end if;

  matched_client_id := resolve_whatsapp_contact_client_id(new.phone_e164);

  if matched_client_id is not null then
    new.linked_client_id := matched_client_id;
    new.linked_client_source := 'auto_phone';
    new.linked_client_matched_at := now();
  elsif new.linked_client_source = 'auto_phone' then
    new.linked_client_id := null;
    new.linked_client_source := null;
    new.linked_client_matched_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists whatsapp_contacts_set_linked_client on whatsapp_contacts;
create trigger whatsapp_contacts_set_linked_client
  before insert or update of phone_e164, linked_client_id, linked_client_source on whatsapp_contacts
  for each row execute function set_whatsapp_contact_linked_client();

create or replace function refresh_whatsapp_contact_links_for_client()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.whatsapp_normalized is not null then
    update whatsapp_contacts
    set phone_e164 = phone_e164
    where (linked_client_id is null or linked_client_source = 'auto_phone')
      and normalize_whatsapp_phone(phone_e164) = old.whatsapp_normalized;
  end if;

  if new.whatsapp_normalized is not null then
    update whatsapp_contacts
    set phone_e164 = phone_e164
    where (linked_client_id is null or linked_client_source = 'auto_phone')
      and normalize_whatsapp_phone(phone_e164) = new.whatsapp_normalized;
  end if;

  return new;
end;
$$;

drop trigger if exists clients_refresh_whatsapp_contact_links on clients;
create trigger clients_refresh_whatsapp_contact_links
  after insert or update of whatsapp_normalized on clients
  for each row execute function refresh_whatsapp_contact_links_for_client();

update whatsapp_contacts
set linked_client_source = 'manual',
    linked_client_matched_at = coalesce(linked_client_matched_at, now())
where linked_client_id is not null
  and linked_client_source is null;

update whatsapp_contacts as contact
set linked_client_id = matches.client_id,
    linked_client_source = 'auto_phone',
    linked_client_matched_at = now()
from (
  select contact.id as contact_id, (array_agg(client.id))[1] as client_id
  from whatsapp_contacts contact
  join clients client
    on client.whatsapp_normalized = normalize_whatsapp_phone(contact.phone_e164)
  where contact.linked_client_id is null
  group by contact.id
  having count(*) = 1
) as matches
where contact.id = matches.contact_id;
