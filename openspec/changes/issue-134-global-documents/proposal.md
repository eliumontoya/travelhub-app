# Proposal: Global trip documents (issue #134)

## Problem

Today documents can only be attached to a **specific itinerary item** (flight,
hotel, activity, etc.) via the `documents` table (`item_id`). The agent
frequently needs documents that belong to the **whole trip** — generic vouchers,
travel insurance, a single passport scan, a consolidated quote — without
forcing them under one arbitrary day/item.

The client also sees item documents in the public trip view (`/t/[slug]`), so a
global document should be just as reachable.

## Proposed change

Add a `trip_documents` table (one global document per trip) plus the data-layer,
server-action, and UI wiring so the agent can upload / list / delete global
documents from the trip editor, and the client can see them in the public view.

The feature deliberately reuses the existing private `trip-documents` Storage
bucket and the same dual mock/Supabase data layer used by item and client docs.

## Out of scope

- Per-item documents already exist; untouched.
- Client-level documents (passport/ID, `client_documents`) already exist; untouched.
- Document categories/labels, reordering, drag-and-drop.
- Public upload (the public view stays read-only).

## Assumptions

- Global trip documents are **client-facing** (like item documents): they show
  in `/t/[slug]` when the trip is published, behind short-lived signed URLs.
- Storage path prefix `trips/{tripId}/...` to avoid collision with
  `documents` (`{itemId}/...`) and `client_documents` (`clients/{clientId}/...`).
