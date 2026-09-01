# Proposal: Data Layer Domain Boundaries

## Intent

Reduce coupling in `src/lib/data.ts`, which currently mixes Supabase access, mock fallback, storage calls, row mapping, and domain rules. The change should make future data-layer work safer by moving related behavior into domain modules while preserving every existing external import through `src/lib/data.ts`.

## Proposal question round

Non-interactive assumptions accepted by the launch request:
- Primary value is maintainability and safer incremental refactors, not new product behavior.
- Existing dashboard/public flows, mock mode, Supabase mode, and storage behavior must stay compatible.
- SQL/schema/RLS changes are out of scope unless a refactor proves impossible without them.

## Scope

### In Scope
- Add contract tests for representative client/tag, trip/itinerary, and document/storage exports before moving code.
- Extract clients/tags, trips/itinerary, and documents/storage into domain modules under `src/lib/data/`.
- Keep `src/lib/data.ts` as a compatibility facade that preserves current named exports.
- Record SDD evidence and verification for issues #269-#273.

### Out of Scope
- Database schema, migration, RLS, or storage bucket changes.
- Next.js route/server action behavior changes.
- Renaming public types or changing app imports outside compatibility needs.

## Capabilities

### New Capabilities
- `data-layer-domain-boundaries`: Stable data-layer facade plus domain modules that preserve mock/Supabase/storage contracts.

### Modified Capabilities
- None.

## Approach

Write contract tests first against existing facade behavior, then move bounded-context code into modules and turn `src/lib/data.ts` into re-exports. Extract shared pagination/utilities only where needed. Keep query shapes and mock mutations behavior-preserving.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/data.ts` | Modified | Compatibility facade for existing imports. |
| `src/lib/data/` | New | Domain modules and shared data-layer utilities. |
| `src/lib/__tests__/` | Modified/New | Contract coverage for preserved facade exports. |
| `openspec/` | Modified | SDD artifacts and archived spec evidence. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Accidental export or behavior drift | Medium | Contract tests import the facade and verify representative behavior. |
| Large PR review load | High | User approved `exception-ok`; keep modules organized by domain. |
| Supabase query/storage drift | Low | Move query code without changing schemas or policies. |

## Rollback Plan

Revert this PR. Since no schema or persisted data changes are planned, rollback restores the monolithic data file and removes only test/SDD/module files.

## Dependencies

- Existing Vitest, TypeScript, lint, and build tooling.

## Success Criteria

- [ ] Existing `src/lib/data.ts` named imports remain valid.
- [ ] Client/tag, trip/itinerary, and document/storage contracts have passing tests.
- [ ] No database schema changes are introduced.
- [ ] Typecheck, lint, and practical build/test verification complete.
