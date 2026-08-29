# Delta for WhatsApp Inbound Automation

## ADDED Requirements

### Requirement: Deterministic WhatsApp contact client linking
The system MUST maintain `whatsapp_contacts.linked_client_id` automatically when a contact phone has exactly one normalized match in `clients.whatsapp_normalized`; no-match or multi-match phones MUST remain unlinked, and manual links MUST NOT be overwritten.

#### Scenario: Unique client match links contact
- GIVEN exactly one client matches a contact phone
- WHEN linking runs on insert, update, or backfill
- THEN `linked_client_id` MUST equal that client id.

#### Scenario: No or ambiguous match remains unlinked
- GIVEN zero or multiple clients match a contact phone
- WHEN automatic linking runs
- THEN no automatic client link MUST be persisted.

#### Scenario: Manual link is preserved
- GIVEN a contact has a manual linked client
- WHEN automatic linking runs
- THEN that link MUST remain unchanged.

#### Scenario: Client WhatsApp change recalculates links
- GIVEN a client's normalized WhatsApp changes
- WHEN matching contacts exist
- THEN eligible null/auto links MUST be recalculated.
