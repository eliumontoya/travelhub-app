# Design: Data Layer Domain Boundaries

## Technical Approach

Keep `src/lib/data.ts` as a pure compatibility facade and move current implementations into modules under `src/lib/data/`. The extraction is mechanical: preserve mock/Supabase branches, row mappers, storage bucket names, and exported type names while grouping by bounded context. No Next routes or Server Actions should need import changes.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Facade | `src/lib/data.ts` re-exports domain modules | Update all app imports | Avoids churn and preserves existing external contract. |
| Module shape | Create domain files: `clients`, `suppliers`, `trips`, `documents`, `dashboard`, `settings`, `feedback`, plus `shared` | Only extract three requested chunks and leave legacy monolith | A facade with residual monolith would keep coupling; domain files make future work targeted. |
| Shared code | Export pagination, `uid`, mock/Supabase helpers, and common mappers only when reused | Duplicate helpers in each module | Keeps behavior consistent without creating a new service layer. |
| Tests | Add facade contract tests before production extraction | Snapshot full data file | Behavioral tests provide useful protection without locking implementation. |

## Data Flow

    Existing callers ── import from @/lib/data ──→ facade re-exports
                                                   │
                                                   ├─ clients/tags
                                                   ├─ trips/itinerary/packing/reminders
                                                   ├─ documents/storage/photos/covers
                                                   └─ supporting domains
                                                        │
                                                        ├─ mock-data when Supabase missing
                                                        └─ Supabase client/storage when configured

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/data.ts` | Modify | Replace monolith with compatibility re-exports. |
| `src/lib/data/shared.ts` | Create | Shared pagination, ids, mock/Supabase helpers, and common mapper exports. |
| `src/lib/data/clients.ts` | Create | Client CRUD, birthdays, referral counts, client tags, tag catalog, trip tags. |
| `src/lib/data/suppliers.ts` | Create | Supplier catalog CRUD and item count helpers. |
| `src/lib/data/trips.ts` | Create | Trips, trip details/history, trip clients, itinerary days, items, packing, reminders. |
| `src/lib/data/documents.ts` | Create | Item/client/trip documents, storage URLs, photos, cover images, site logo upload. |
| `src/lib/data/dashboard.ts` | Create | Recent activity and trip stats derivations. |
| `src/lib/data/settings.ts` | Create | Site settings read/write. |
| `src/lib/data/feedback.ts` | Create | Trip feedback mutations and reads. |
| `src/lib/__tests__/data-domain-contracts.test.ts` | Create | Contract tests importing through `@/lib/data` and direct domain modules. |

## Interfaces / Contracts

No public type names change. Domain modules export the same functions/types currently exported by `src/lib/data.ts`; the facade re-exports them with `export *` statements.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit/contract | Facade and direct domain exports, mock client/tag flows, trip detail assembly, document mock/storage behavior | Vitest against `@/lib/data` and domain modules with Supabase unconfigured. |
| Static | Import compatibility and no type drift | `npx tsc --noEmit`. |
| App integration | Existing behavior remains usable | Existing unit suite, lint, and build. |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary is changed by the implementation.

## Migration / Rollout

No data migration or schema change required. Roll out as one code-only PR; rollback is a normal revert.

## Open Questions

None — launch request explicitly chose a full single-run `exception-ok` delivery.
