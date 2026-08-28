# Delta for Client CRM

## MODIFIED Requirements

### Requirement: Client records

The system MUST let the agent list, create, view, and update clients with name, email, phone, WhatsApp, notes, birth date, referral source, created timestamp, and updated timestamp. When a client save includes a phone number and blank WhatsApp, the saved client MUST store the phone number as WhatsApp. When WhatsApp is explicitly provided, the system MUST preserve that value even if it differs from phone.
(Previously: client records did not expose WhatsApp in CRM forms, although phone and other profile fields were editable.)

#### Scenario: Create a valid client

- GIVEN the agent is on the authenticated clients surface
- WHEN they submit a client name with optional contact details
- THEN the client is created and returned with a stable id and timestamps

#### Scenario: Reject duplicate email

- GIVEN a client already exists with an email address
- WHEN the agent tries to create another client using the same email
- THEN the system MUST return an error instead of creating a duplicate

#### Scenario: Blank WhatsApp copies phone on save

- GIVEN the agent submits a client form with phone present and WhatsApp blank
- WHEN the client is saved
- THEN the stored client WhatsApp MUST equal the submitted phone

#### Scenario: Explicit WhatsApp is preserved

- GIVEN the agent submits a client form with phone and a different WhatsApp value
- WHEN the client is saved
- THEN the stored client WhatsApp MUST equal the submitted WhatsApp value
