# Proposal: Enriched trip instructions field (issue #147)

## Problem

The trip-level "Instrucciones" field still renders and stores as plain text only.
PR #146 enriched every NOTE field (client, trip-day, item, supplier, internal
trip) with rich/sanitized HTML, but the trip `instructions` column was missed.

## Why now

Issue #147 ("Campo instrucciones enriquecido") explicitly asks that the trip
"Instrucciones" field also be enriched, reusing the same components and
sanitize path introduced by #146.

## Approach

- Reuse the existing `sanitizeNote` allowlist (`src/lib/sanitize.ts`), the
  `RichTextEditor` client component, and the `NoteHtml` renderer from #146.
  No new sanitization logic is introduced.
- Sanitize `instructions` on write in the data layer (`createTrip` and
  `updateTrip` for both mock and Supabase paths), matching how notes are handled.
- Replace the plain `<textarea>` in `TripInstructionsDialog` and `NewTripForm`
  with `RichTextEditor` (label "Instrucciones").
- Render the stored HTML in the public traveler view via `NoteHtml` (the
  dashboard has no instructions rendering surface besides the editor dialog).

## Rollback plan

`instructions` remains a string column — no schema migration. Reverting the UI
files restores the plain-text textarea; stored HTML degrades gracefully to plain
text. No data backfill needed.

## Assumptions

- The same allowlist and sanitize-on-write + sanitize-on-render posture used for
  notes is appropriate for instructions (it is also shown in the unauthenticated
  public view).
- Dashboard trip detail page does not currently render `instructions`, so the
  only render change is in the public `/t/[slug]` view.
