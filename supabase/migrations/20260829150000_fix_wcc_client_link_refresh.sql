-- Fix client-driven WCC contact relinking after issue #253.
-- Update eligible contacts directly instead of relying on a no-op contact update.

create or replace function refresh_whatsapp_contact_links_for_client()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.whatsapp_normalized is not null then
    update whatsapp_contacts as contact
    set linked_client_id = resolved.client_id,
        linked_client_source = case when resolved.client_id is null then null else 'auto_phone' end,
        linked_client_matched_at = case when resolved.client_id is null then null else now() end
    from (
      select id, resolve_whatsapp_contact_client_id(phone_e164) as client_id
      from whatsapp_contacts
      where (linked_client_id is null or linked_client_source = 'auto_phone')
        and normalize_whatsapp_phone(phone_e164) = old.whatsapp_normalized
    ) as resolved
    where contact.id = resolved.id;
  end if;

  if new.whatsapp_normalized is not null then
    update whatsapp_contacts as contact
    set linked_client_id = resolved.client_id,
        linked_client_source = case when resolved.client_id is null then null else 'auto_phone' end,
        linked_client_matched_at = case when resolved.client_id is null then null else now() end
    from (
      select id, resolve_whatsapp_contact_client_id(phone_e164) as client_id
      from whatsapp_contacts
      where (linked_client_id is null or linked_client_source = 'auto_phone')
        and normalize_whatsapp_phone(phone_e164) = new.whatsapp_normalized
    ) as resolved
    where contact.id = resolved.id;
  end if;

  return new;
end;
$$;

drop trigger if exists clients_refresh_whatsapp_contact_links on clients;
create trigger clients_refresh_whatsapp_contact_links
  after insert or update of phone, whatsapp, whatsapp_normalized on clients
  for each row execute function refresh_whatsapp_contact_links_for_client();
