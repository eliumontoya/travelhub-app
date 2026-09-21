# Proposal: Prevent Orphaned Service-Document Storage Objects

## Intent

Prevent `uploadServiceDocument` from silently leaving an unreferenced Storage object when the new object uploads successfully but the `service_uploads` database upsert fails. The change must preserve the last valid upload during failed replacements and report incomplete compensation honestly.

## Scope

### In Scope
- Delete only the newly uploaded provisional object when the corresponding database upsert fails.
- Preserve the existing database row and its referenced object when a replacement upsert fails.
- Surface both the database failure and any cleanup failure without claiming atomicity across Postgres and Storage.
- Add strict-TDD coverage for failed upserts, cleanup failures, and successful replacement ordering.

### Out of Scope
- Changes to other upload flows or Storage helpers outside service-document uploads.
- Database schema, RLS, bucket, UI, or public API changes.
- Durable cleanup queues, retry workers, reconciliation jobs, or guarantees of cross-system atomicity.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `client-document-upload`: Define failure-compensation guarantees for service-document uploads and replacements when database persistence fails after Storage upload.

## Approach

Treat the newly uploaded path as provisional until the `service_uploads` upsert succeeds. If the upsert fails, perform a compensating Storage removal for that new path only, then reject the operation. Keep deletion of the previously referenced object after a successful upsert so a failed replacement cannot destroy the valid file. If compensation also fails, return failure information that retains both errors and makes the remaining orphan risk explicit.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/data/services.ts` | Modified | Add bounded compensation to `uploadServiceDocument` while preserving replacement ordering. |
| `src/lib/data/__tests__/services.test.ts` | Modified | Add Supabase-mode failure and ordering coverage under strict TDD. |
| `openspec/specs/client-document-upload/spec.md` | Modified | Extend observable upload behavior with failure-compensation requirements. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Cleanup can fail after the database upsert fails, leaving the new object orphaned. | Medium | Surface both failures and the unresolved orphan risk; do not report success or atomic rollback. |
| Compensation could remove the previously referenced object during a failed replacement. | Low | Delete only the exact newly uploaded path and prove this boundary with tests. |
| Changing operation order could remove the old object before the row references the replacement. | Low | Retain old-object deletion strictly after a successful upsert and cover the ordering contract. |
| Supabase fluent-query mocks may diverge from the real call chain. | Medium | Keep the test double focused on the observed Storage and upsert sequence without broad mock refactoring. |

## Rollback Plan

Revert the compensation and its focused tests to restore the current upload/upsert sequence. No data migration or schema rollback is required. Any objects orphaned before or during rollback remain an operational cleanup concern because this change does not add durable reconciliation.

## Dependencies

- Existing Supabase Storage client and `service_uploads` upsert flow in `src/lib/data/services.ts`.
- Existing Vitest suite run with `npm run test`.

## Success Criteria

- [ ] A failed `service_uploads` upsert triggers removal of only the newly uploaded Storage path.
- [ ] A failed replacement leaves the prior database row and referenced Storage object intact.
- [ ] A cleanup failure is reported together with the original database failure and is never presented as a successful upload or atomic rollback.
- [ ] A successful replacement updates the row before deleting the previously referenced object.
- [ ] Focused tests are developed with RED → GREEN → REFACTOR and `npm run test` passes.
