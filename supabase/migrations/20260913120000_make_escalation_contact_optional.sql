-- Make contact_id and conversation_id optional in whatsapp_escalations
-- This allows escalations to be created for any person, not just those
-- with an existing contact/conversation record.

alter table whatsapp_escalations
  alter column contact_id drop not null,
  alter column conversation_id drop not null;
