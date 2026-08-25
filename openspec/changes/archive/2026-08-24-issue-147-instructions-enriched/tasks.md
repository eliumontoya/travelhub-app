# Tasks: Enriched trip instructions field (issue #147)

## 1. Sanitize instructions on write
- [x] `createTrip` (mock + supabase) sanitizes `instructions` via `sanitizeNote`
- [x] `updateTrip` (mock + supabase) sanitizes `instructions` via `sanitizeNote`

## 2. Enrich the editor UI
- [x] `TripInstructionsDialog` uses `RichTextEditor` for "Instrucciones"
- [x] `NewTripForm` uses `RichTextEditor` for "Instrucciones"

## 3. Render as HTML in public view
- [x] `/t/[slug]` renders `trip.instructions` via `NoteHtml`

## 4. Docs
- [x] SDD artifacts under `openspec/changes/issue-147-instructions-enriched/`

## 5. Verify
- [x] `npx tsc --noEmit` passes
- [x] `npm run build` passes
- [x] Existing tests pass
