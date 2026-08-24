# Client CRM Specification

**Baseline**: baseline-from-current-implementation

## Purpose

Manage client records, tags, documents, and travel history for the travel agent.

## Requirements

### Requirement: Client records

The system MUST let the agent list, create, view, and update clients with name, email, phone, notes, birth date, referral source, created timestamp, and updated timestamp.

#### Scenario: Create a valid client

- GIVEN the agent is on the authenticated clients surface
- WHEN they submit a client name with optional contact details
- THEN the client is created and returned with a stable id and timestamps

#### Scenario: Reject duplicate email

- GIVEN a client already exists with an email address
- WHEN the agent tries to create another client using the same email
- THEN the system MUST return an error instead of creating a duplicate

### Requirement: Client discovery

The system MUST provide a dedicated `/dashboard/clients` index with paginated clients, loaded-page text filtering, tags, contact details, and links to client detail pages.

#### Scenario: Browse registered clients

- GIVEN more clients exist than fit on one page
- WHEN the agent opens `/dashboard/clients?page=2`
- THEN the page MUST show the requested page and preserve navigation to other pages

#### Scenario: Export filtered clients

- GIVEN the agent filtered the loaded clients list
- WHEN they export clients to CSV
- THEN the CSV MUST contain only the matching loaded clients and standard client fields

### Requirement: Client detail workspace

The system MUST show a client detail page with editable profile fields, tags, document attachments, trip summary counts, and linked trips.

#### Scenario: Review client history

- GIVEN a client has draft, published, and archived trips
- WHEN the agent opens the client detail page
- THEN the page MUST show trip counts and links to each trip editor

#### Scenario: Manage client documents

- GIVEN the agent uploads or deletes a client document
- WHEN the operation succeeds
- THEN the document list MUST reflect the changed attachment set

### Requirement: Public client trip history

The system MUST expose `/c/{clientSlug}` as a public history page containing only the client's published trips.

#### Scenario: Open public client profile

- GIVEN a client has a public slug and at least one published trip
- WHEN a visitor opens `/c/{clientSlug}`
- THEN the visitor MUST see the client name and published trip links only
