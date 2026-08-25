# Archive Report: bugfixes-162-163-166-168

**Change**: bugfixes-162-163-166-168
**Archived to**: `openspec/changes/archive/2026-08-25-bugfixes-162-163-166-168/`
**Archived on**: 2026-08-25
**Archive mode**: intentional retrospective OpenSpec archive for non-SDD bugfixes
**Review Delivery**: disabled/unmanaged (receipt-driven development OFF)
**Verdict**: PASS

## Summary

The user requested a lightweight bugfix flow without SDD. Each issue was implemented in its own worktree and branch, merged through its own PR, and is now recorded in OpenSpec as a completed batch so the source-of-truth specs reflect the final behavior.

| Issue | Title | PR | Merge commit | Final behavior |
|-------|-------|----|--------------|----------------|
| #162 | Notas de día no visibles | #164 | `37164f4` | Day notes visible in dashboard and traveler views |
| #163 | Notas enriquecidas fallan | #165 | `84af867` | Rich notes preserve safe tables and toolbar formatting works reliably |
| #166 | Borrador y vista previa | #167 | `1f55848` | Draft preview URL and published-trip edit lock |
| #168 | Visualización incompleta de items | #169 | `20f801a` | Traveler item cards expand to full details including documents |

## Intentional Non-SDD Archive Note

No active `openspec/changes/{change}` folders existed for issues #162, #163, #166, or #168 because the user explicitly instructed: simple bugs, no SDD, one worktree/branch per issue. This archive is therefore an intentional retrospective audit trail rather than a normal SDD archive move.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `public-trip-sharing` | Updated | Added draft preview URL and complete traveler item details requirements |
| `trip-itinerary` | Updated | Added day notes visibility and rich note formatting fidelity; updated lifecycle scenarios for published edit lock |

## Verification

All implementation PRs were merged to `main`. During issue work, each branch passed:

- `npx tsc --noEmit`
- `npm run test`
- `npm run lint` (with one pre-existing warning in `MoveItemToDayDialog.tsx`)
- `npm run build`

## Archive Contents

- proposal.md ✅
- design.md ✅
- tasks.md ✅ (all tasks complete)
- verify-report.md ✅
- specs/public-trip-sharing/spec.md ✅
- specs/trip-itinerary/spec.md ✅
- archive-report.md ✅

## Source of Truth Updated

- `openspec/specs/public-trip-sharing/spec.md`
- `openspec/specs/trip-itinerary/spec.md`

## Closure

The four bugfix flows are merged and archived. The OpenSpec source of truth now reflects their observable behavior.
