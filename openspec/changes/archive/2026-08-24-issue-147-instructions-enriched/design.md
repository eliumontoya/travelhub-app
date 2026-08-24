# Design: Enriched trip instructions field (issue #147)

## Reuse map (no new primitives)

- Sanitizer: `sanitizeNote` in `src/lib/sanitize.ts` (same allowlist as notes).
- Editor: `RichTextEditor` (`src/components/RichTextEditor.tsx`) — emits HTML
  into a hidden `<textarea name="instructions">`, so existing form actions keep
  working unchanged.
- Renderer: `NoteHtml` (`src/components/NoteHtml.tsx`) — sanitizes on render too.

## Data layer (single choke point)

`src/lib/data.ts`:
- `createTrip` mock path: `instructions: sanitizeNote(input.instructions)`
- `createTrip` supabase path: `instructions: sanitizeNote(input.instructions) || null`
- `updateTrip` mock path: `input.instructions ? sanitizeNote(input.instructions) : undefined`
- `updateTrip` supabase path: `patch.instructions = sanitizeNote(input.instructions)`

This mirrors the existing note sanitization lines (e.g. `client.notes`,
`supplier.notes`, `day.notes`, `item.notes`).

## UI

- `src/components/TripInstructionsDialog.tsx`: swap `<textarea name="instructions">`
  for `<RichTextEditor name="instructions" defaultValue={trip.instructions} .../>`.
- `src/components/NewTripForm.tsx`: same swap; no `defaultValue` (new trip).
- `src/app/t/[slug]/page.tsx`: replace the `<p className="whitespace-pre-line">`
  with `<NoteHtml html={trip.instructions} ... />`. Dashboard has no instructions
  render surface, so no other view changes.

## Out of scope
- Filtering on `instructions` (`trip-filters.ts`) keeps matching raw text/HTML;
  notes are not filtered either, so behavior is consistent.
