# Client CRM Specification

**Baseline**: baseline-from-current-implementation

## Purpose

Manage client records, tags, documents, and travel history for the travel agent.

## Requirements

### Requirement: Client records

The system MUST let the agent list, create, view, and update clients with name, email, phone, WhatsApp, notes, birth date, referral source, created timestamp, and updated timestamp. When a client save includes a phone number and blank WhatsApp, the saved client MUST store the phone number as WhatsApp. When WhatsApp is explicitly provided, the system MUST preserve that value even if it differs from phone.

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

### Requirement: Store client cover image URL

The system MUST persist an optional cover image URL on each client.

#### Scenario: Client has no cover by default

- GIVEN a client with no cover image set
- WHEN the client is loaded
- THEN `coverImageUrl` MUST be `undefined` (or null) and the profile MUST render the default banner

#### Scenario: Cover URL is persisted

- GIVEN the agent uploads a cover image for a client
- WHEN the client is reloaded
- THEN the stored `coverImageUrl` MUST equal the uploaded image's public URL

### Requirement: Upload a cover image from client detail

The system MUST let the authenticated agent upload an image file as the client
cover from the client detail page.

#### Scenario: Successful upload

- GIVEN Supabase is configured and the agent is on a client detail page
- WHEN they choose an image file and submit it
- THEN the system MUST upload it to the `client-covers` bucket, store its public URL on the client, and revalidate the client page

#### Scenario: Replace existing cover

- GIVEN a client already has a cover image
- WHEN the agent uploads a new one
- THEN the system MUST store the new URL, replacing the previous cover

#### Scenario: Storage not configured

- GIVEN Supabase is not configured
- WHEN the agent views the client detail page
- THEN the system MUST hide the upload control and show a "configure Supabase" hint (mirroring other upload features)

### Requirement: Remove a cover image

The system MUST let the agent clear the client's cover image.

#### Scenario: Remove cover

- GIVEN a client has a cover image
- WHEN the agent removes it
- THEN `coverImageUrl` MUST become undefined and the profile MUST render the default banner

### Requirement: Render cover on public profile

The public client history page (`/c/[slug]`) MUST render the cover image as the
banner background when present.

#### Scenario: Cover shown on public profile

- GIVEN a client has a cover image
- WHEN a visitor opens `/c/[slug]`
- THEN the banner MUST use the cover image as its background

#### Scenario: Default banner when no cover

- GIVEN a client has no cover image
- WHEN a visitor opens `/c/[slug]`
- THEN the banner MUST render the default gray gradient background

### Requirement: Public access to cover image

The cover image object MUST be publicly readable so the unauthenticated
`/c/[slug]` page can display it.

#### Scenario: Anonymous read of cover object

- GIVEN a cover image was uploaded to `client-covers`
- WHEN an unauthenticated client requests its public URL
- THEN the object MUST be returned (bucket is public, owner-only write)

### Requirement: Sanitized note storage

The data layer MUST store note text as HTML sanitized through a single server-side `sanitizeNote` helper before persisting `client.notes`.

#### Scenario: Script tags are stripped on write

- GIVEN an agent submits a note containing `<script>alert(1)</script>`
- WHEN the value is persisted through `src/lib/data.ts`
- THEN the stored value MUST NOT contain a `<script>` tag

#### Scenario: Allowed formatting is preserved

- GIVEN an agent submits `<p>Texto <strong>clave</strong></p><ul><li>a</li></ul>`
- WHEN the value is persisted
- THEN the stored value MUST retain `<strong>` and the `<ul>/<li>` list

### Requirement: Safe note rendering

The system MUST render note HTML through a `NoteHtml` component that
re-sanitizes before output, so untrusted or legacy content cannot inject
scripts, event handlers, or `javascript:` URLs into the DOM.

#### Scenario: XSS payload is neutralized on render

- GIVEN a stored note `<img src=x onerror=alert(1)><a href="javascript:evil()">x</a>`
- WHEN it is rendered via `NoteHtml`
- THEN the output MUST NOT contain `onerror` and MUST NOT contain `javascript:`

#### Scenario: Links open safely

- GIVEN a rendered note contains an `<a href="https://ok.com">`
- WHEN it is displayed
- THEN the anchor MUST include `target="_blank"` and `rel="noopener noreferrer"`

### Requirement: Rich text editor for client notes

The client note input MUST use a `RichTextEditor` supporting bold, italic,
underline, unordered/ordered lists, and links, submitting sanitized HTML via a
form field named `notes`.

#### Scenario: Toolbar produces HTML

- GIVEN the agent selects text and clicks "Negrita"
- WHEN the form is submitted
- THEN `formData.get("notes")` MUST contain `<strong>` markup for that text

### Requirement: Plain-text export

The client CSV export MUST contain note text with HTML tags stripped.

#### Scenario: CSV has no markup

- GIVEN a client note `<p>Hola <strong>mundo</strong></p>`
- WHEN the agent exports clients to CSV
- THEN the Notes column for that client MUST contain `Hola mundo`

### Requirement: Delete client with confirmation

The system MUST let the authenticated agent delete a client from the clients console only after confirming the deletion intent.

#### Scenario: Delete after exact-name confirmation

- GIVEN a client exists in the authenticated clients console
- WHEN the agent initiates deletion and confirms with the client's current exact name
- THEN the client MUST be removed from the clients list
- AND the system MUST refresh the affected dashboard views

#### Scenario: Reject missing or incorrect confirmation

- GIVEN a client exists in the authenticated clients console
- WHEN a delete request is submitted without confirmation or with a different name
- THEN the client MUST remain stored
- AND the delete action MUST NOT remove related records

#### Scenario: Preserve trips while removing client relationships

- GIVEN a client is assigned to one or more trips
- WHEN the client is deleted after valid confirmation
- THEN the system MUST remove the deleted client's assignment, tag, and document relationships according to the schema
- AND the system MUST NOT delete the trips themselves
