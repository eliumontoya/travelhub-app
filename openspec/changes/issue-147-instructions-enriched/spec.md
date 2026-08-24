# Spec: Enriched trip instructions field (issue #147)

## ADDED Requirements

### Requirement: Trip instructions stored as sanitized HTML
The trip `instructions` value MUST be sanitized with `sanitizeNote` before being
persisted, in both `createTrip` and `updateTrip`, for the mock and Supabase data
paths. Empty or whitespace-only input MUST be stored as `null`/undefined.

#### Scenario: Write from rich editor
- GIVEN a user edits trip instructions with bold text and a link via `RichTextEditor`
- WHEN the form is submitted
- THEN `updateTripInstructionsAction` persists the `sanitizeNote`-sanitized HTML

#### Scenario: Script injection is stripped
- GIVEN instructions input containing `<script>alert(1)</script>`
- WHEN saved and rendered
- THEN no script executes and the stored value contains no disallowed tags

### Requirement: Trip instructions edited with rich editor
The `TripInstructionsDialog` and `NewTripForm` "Instrucciones" fields MUST use
`RichTextEditor` instead of a plain `<textarea>`.

### Requirement: Trip instructions rendered as HTML in public view
The public trip view (`/t/[slug]`) MUST render `trip.instructions` via `NoteHtml`
(rich HTML) instead of a plain `<p>`.

## UNCHANGED Requirements
- All note fields enriched by #146 (client, trip-day, item, supplier, internal)
  remain unchanged.
