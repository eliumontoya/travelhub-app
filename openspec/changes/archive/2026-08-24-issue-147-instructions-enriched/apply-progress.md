# Apply Progress: issue-147-instructions-enriched

## Change state

- **Change**: issue-147-instructions-enriched
- **Mode**: Strict TDD (reconciliation of already-merged implementation)
- **Delivery strategy**: single-pr + exception-ok
- **PR boundary**: PR #148 already merged to `main` (merge `090fb4b` via PR #149; feature commit `e57f841`)
- **Status**: 5/5 tasks complete. Ready for verify / archive.

## Completed Tasks

### 1. Sanitize instructions on write
- [x] `createTrip` (mock + supabase) sanitizes `instructions` via `sanitizeNote`
- [x] `updateTrip` (mock + supabase) sanitizes `instructions` via `sanitizeNote`

### 2. Enrich the editor UI
- [x] `TripInstructionsDialog` uses `RichTextEditor` for "Instrucciones"
- [x] `NewTripForm` uses `RichTextEditor` for "Instrucciones"

### 3. Render as HTML in public view
- [x] `/t/[slug]` renders `trip.instructions` via `NoteHtml`

### 4. Docs
- [x] SDD artifacts under `openspec/changes/issue-147-instructions-enriched/`

### 5. Verify
- [x] `npx tsc --noEmit` passes
- [x] `npm run build` passes
- [x] Existing tests pass

## File:line evidence

| Requirement | File | Lines | Evidence |
|---|---|---|---|
| `createTrip` mock sanitizes `instructions` | `src/lib/data.ts` | 1414 | `instructions: sanitizeNote(input.instructions)` |
| `createTrip` supabase sanitizes `instructions` | `src/lib/data.ts` | 1450 | `instructions: sanitizeNote(input.instructions) \|\| null` |
| `updateTrip` mock sanitizes `instructions` | `src/lib/data.ts` | 1623 | `trip.instructions = input.instructions ? sanitizeNote(input.instructions) : undefined` |
| `updateTrip` supabase sanitizes `instructions` | `src/lib/data.ts` | 1662 | `patch.instructions = sanitizeNote(input.instructions)` |
| `TripInstructionsDialog` rich editor | `src/components/TripInstructionsDialog.tsx` | 50-54 | `<RichTextEditor name="instructions" defaultValue={trip.instructions} ... />` |
| `NewTripForm` rich editor | `src/components/NewTripForm.tsx` | 42-45 | `<RichTextEditor name="instructions" ... />` |
| Public view renders HTML | `src/app/t/[slug]/page.tsx` | 154-161 | `<NoteHtml html={trip.instructions} ... />` |

## TDD Cycle Evidence

This apply phase is a **reconciliation** of code already merged via PR #148. Sections 1-4 were implemented and merged before this apply run, so no new RED/GREEN/REFACTOR cycles were executed here. The table below records the verification evidence for each task.

| Task | RED (test first) | GREEN (verification passes) | REFACTOR |
|---|---|---|---|
| 1.1 `createTrip` sanitizes `instructions` | N/A — pre-merged in PR #148 | `npm run test`: 108 passed; `npx tsc --noEmit`: clean | N/A — no changes required |
| 1.2 `updateTrip` sanitizes `instructions` | N/A — pre-merged in PR #148 | `npm run test`: 108 passed; `npx tsc --noEmit`: clean | N/A — no changes required |
| 2.1 `TripInstructionsDialog` uses `RichTextEditor` | N/A — pre-merged in PR #148 | `npm run build`: success; `npx tsc --noEmit`: clean | N/A — no changes required |
| 2.2 `NewTripForm` uses `RichTextEditor` | N/A — pre-merged in PR #148 | `npm run build`: success; `npx tsc --noEmit`: clean | N/A — no changes required |
| 3.1 `/t/[slug]` renders via `NoteHtml` | N/A — pre-merged in PR #148 | `npm run build`: success; `npx tsc --noEmit`: clean | N/A — no changes required |
| 4.1 SDD artifacts present | N/A — pre-existing | Verified `proposal.md`, `spec.md`, `design.md`, `tasks.md` | N/A — no changes required |
| 5.1 `npx tsc --noEmit` passes | N/A — verification task | Exit 0, no output | N/A |
| 5.2 `npm run build` passes | N/A — verification task | Exit 0, build succeeded with 13 static pages | N/A |
| 5.3 Existing tests pass | N/A — verification task | 18 test files, 108 tests passed | N/A |

## Verification command results

```text
$ npm run build
> next build
...
✓ Generating static pages using 11 workers (13/13)

$ npx tsc --noEmit
(no output)

$ npm run test
> vitest run
Test Files  18 passed (18)
Tests       108 passed (108)
```

## Deviations from design

None — implementation matches design.

## Issues found

None.

## Rollback boundary

`instructions` remains a string column; reverting the three UI/data lines restores plain-text behavior. No schema migration or data backfill was required.

## Next recommended phase

`sdd-verify` or `sdd-archive`.
