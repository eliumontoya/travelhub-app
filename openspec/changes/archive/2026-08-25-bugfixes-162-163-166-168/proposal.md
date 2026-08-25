# Proposal: Bugfix batch #162, #163, #166, #168

## Intent

Archive the final merged state for four lightweight, non-SDD bug fixes requested by the user:

- #162 — Day notes were stored but not visible in dashboard or traveler itineraries.
- #163 — Rich notes did not preserve/render all expected formatting, especially pasted tables and toolbar bold selection.
- #166 — Draft trips needed a temporary preview URL, and published trips needed to be locked from itinerary edits.
- #168 — Traveler item cards needed complete expandable details, including item documents.

## Scope

This was an intentional non-SDD bugfix batch. The user explicitly asked to skip SDD for these simple bugs and to use one worktree/branch per issue. This archive records the merged behavior into OpenSpec after the fact.

## Delivery

Each issue was implemented in its own worktree/branch and merged through its own PR:

| Issue | PR | Merge commit |
|-------|----|--------------|
| #162 | #164 | `37164f4` |
| #163 | #165 | `84af867` |
| #166 | #167 | `1f55848` |
| #168 | #169 | `20f801a` |

## Rollback

Each bugfix can be reverted independently by reverting its merge commit. The OpenSpec archive can be amended in a follow-up docs/spec PR if any individual revert occurs.
