-- CRM WhatsApp lookup for inbound dynamic TravelHub tools (issue #221).
-- Additive and nullable: existing forms can keep writing only phone while the
-- database maintains a comparable WhatsApp lookup value for imports/scripts.

alter table clients
  add column if not exists whatsapp text;

alter table clients
  add column if not exists whatsapp_normalized text;

create or replace function set_client_whatsapp_from_phone()
returns trigger
language plpgsql
as $$
begin
  if nullif(btrim(new.whatsapp), '') is null
     and nullif(btrim(new.phone), '') is not null then
    new.whatsapp := new.phone;
  end if;

  new.whatsapp_normalized := nullif(regexp_replace(coalesce(new.whatsapp, ''), '\D', '', 'g'), '');

  return new;
end;
$$;

drop trigger if exists clients_set_whatsapp_from_phone on clients;
create trigger clients_set_whatsapp_from_phone
  before insert or update on clients
  for each row execute function set_client_whatsapp_from_phone();

update clients
set whatsapp = phone,
    whatsapp_normalized = nullif(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '')
where nullif(btrim(whatsapp), '') is null
  and nullif(btrim(phone), '') is not null;

update clients
set whatsapp_normalized = nullif(regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g'), '')
where nullif(btrim(whatsapp), '') is not null
  and whatsapp_normalized is distinct from nullif(regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g'), '');

-- Match the digits-only normalization used for webhook event.fromPhone and
-- avoid indexing blank CRM values. B-tree supports exact normalized lookup.
create index if not exists idx_clients_whatsapp_normalized
  on clients (whatsapp_normalized)
  where whatsapp_normalized is not null;
