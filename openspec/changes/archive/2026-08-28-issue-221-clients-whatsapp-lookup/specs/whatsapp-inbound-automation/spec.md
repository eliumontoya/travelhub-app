# Delta for WhatsApp Inbound Automation

## MODIFIED Requirements

### Requirement: WhatsApp phone client resolution
The system MUST resolve dynamic TravelHub lookups from the inbound WhatsApp phone to a TravelHub client before returning client- or trip-specific data. It MUST compare the inbound phone using a digits-only normalized form compatible with webhook `event.fromPhone`. It MUST prefer an exact match on normalized `clients.whatsapp`, MAY use `whatsapp_contacts.linked_client_id` as a manual compatibility override when no CRM WhatsApp match exists, and SHOULD retain legacy `clients.phone` fallback during migration. If multiple clients match at the same lookup tier, the system MUST return an ambiguous result and MUST NOT expose trip-specific data.
(Previously: resolution used linked WhatsApp contact first, then exact `clients.phone` fallback.)

#### Scenario: CRM WhatsApp resolves client
- GIVEN a client has `clients.whatsapp` matching the inbound phone after digits-only normalization
- WHEN client resolution runs
- THEN the result MUST identify that client with exact confidence
- AND it MUST NOT require a linked WhatsApp contact row.

#### Scenario: Manual link remains fallback
- GIVEN no client matches `clients.whatsapp`
- AND a WhatsApp contact row exists for the inbound phone with a linked TravelHub client
- WHEN client resolution runs
- THEN the result MUST identify the linked client with exact confidence.

#### Scenario: CRM duplicate is ambiguous
- GIVEN multiple clients match the inbound phone by normalized `clients.whatsapp`
- WHEN client resolution runs
- THEN the result MUST be ambiguous
- AND no trip-specific lookup MUST run from that result.

#### Scenario: No client match escalates safely
- GIVEN no linked WhatsApp contact, no exact CRM WhatsApp match, and no legacy client-phone match exists for the inbound phone
- WHEN client resolution runs
- THEN the result MUST indicate no match
- AND the caller MUST be able to escalate without exposing private TravelHub data.

## ADDED Requirements

### Requirement: Client WhatsApp CRM storage
The system MUST store an optional WhatsApp phone field on `clients`, backfill it from existing `phone` values when blank, default it from `phone` on future insert/update when blank, and provide an index suitable for normalized WhatsApp lookup.

#### Scenario: Blank WhatsApp is copied from phone
- GIVEN a client row is inserted or updated with `phone` present and `whatsapp` null or blank
- WHEN the database write executes
- THEN `clients.whatsapp` MUST store the phone value.

#### Scenario: Explicit WhatsApp is preserved
- GIVEN a client row has an explicit non-blank `whatsapp`
- WHEN `phone` changes
- THEN the database MUST NOT overwrite the explicit WhatsApp value.
