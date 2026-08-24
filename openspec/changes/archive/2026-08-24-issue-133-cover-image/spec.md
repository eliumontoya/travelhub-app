# Spec: Client Profile Cover Image (issue #133)

**Baseline**: new-capability

## Purpose

Allow the agent to set a cover image for a client profile that is displayed on
the public client history page, replacing the static gray banner.

## Requirements

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
