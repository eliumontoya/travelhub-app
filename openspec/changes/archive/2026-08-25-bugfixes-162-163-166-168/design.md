# Design: Bugfix batch #162, #163, #166, #168

## Approach

The fixes preserved the existing App Router + Server Components architecture and reused shared components/helpers where possible.

## Issue #162 — Day notes visibility

- Reused `NoteHtml` for safe rendering.
- Rendered `day.notes` near day headers in both dashboard trip editor and public traveler view.
- Kept note presentation discreet to preserve the itinerary card structure.

## Issue #163 — Rich notes formatting

- Extended the note sanitizer to allow safe table tags and table cell span attributes.
- Extended `NoteHtml` styling for responsive/bordered tables.
- Prevented rich-text toolbar mouse-down from stealing the contenteditable selection before `document.execCommand` runs.

## Issue #166 — Draft preview and published lock

- Added a lightweight preview URL model: `/t/{slug}?preview={tripId}` for draft review.
- Kept final `/t/{slug}` published-only.
- Hid dashboard mutation controls for published trips.
- Added server-action guards so direct mutation attempts are rejected while a trip is published.

## Issue #168 — Traveler expandable item details

- Used native `details`/`summary` disclosure controls to avoid extra client state.
- Kept primary item information visible for scanning.
- Added expanded details for notes, confirmation, visible costs, structured metadata, supplier info, maps, and item documents.
- Attached signed URLs to item documents when assembling trip details.

## Risks and Constraints

- Draft preview tokens are lightweight and based on trip ID, not signed expiring tokens. This matches the current single-admin/no-migration workflow but should be revisited if previews must be externally shareable.
- Item document links use signed URLs generated during server render and expire according to the existing document URL policy.
