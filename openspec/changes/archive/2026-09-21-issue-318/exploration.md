## Exploration: Prevent orphaned service-document storage objects

### Current State
`uploadServiceDocument` validates ownership, reads the current upload path, uploads a uniquely named object to the private `trip-documents` bucket, and only then upserts `service_uploads`. If the upsert fails, the function throws without removing the new object, so Storage can retain an object that no database row references. Replacement uploads otherwise preserve the prior object until the upsert succeeds, then delete the prior path.

The current test suite exercises this workflow only in mock mode and has no Supabase-mode failure test proving cleanup. The relevant baseline specifications require one file per checklist item and replacement of the prior object, but do not yet define failure compensation.

### Affected Areas
- `src/lib/data/services.ts` — `uploadServiceDocument` needs compensation between successful Storage upload and failed database upsert; its current location is around line 589, not the older issue reference near line 433.
- `src/lib/data/__tests__/services.test.ts` — needs a focused Supabase-client test that makes the upsert fail and verifies removal of only the newly uploaded path plus propagation of failure.
- `openspec/specs/client-document-upload/spec.md` — the baseline behavior that a proposal/spec delta should extend with storage-cleanup failure semantics.

### Approaches
1. **Compensating Storage delete** — if the database upsert fails, immediately remove the newly uploaded path and then reject the operation; keep old-path deletion after a successful upsert only.
   - Pros: Small, local change; preserves the last valid upload during replacement; matches the existing Storage/data-layer ownership; directly covers the reported failure window.
   - Cons: Cross-system atomicity remains impossible; cleanup itself can fail and must be surfaced without reporting success.
   - Effort: Low

2. **Database-first provisional record with rollback** — write provisional metadata before uploading, then finalize it or restore/delete it if Storage fails.
   - Pros: Database can expose pending work for later reconciliation.
   - Cons: Temporarily points at a missing object, complicates replacement rollback, expands schema/state semantics, and still requires compensation across systems.
   - Effort: Medium

3. **Durable cleanup workflow** — record upload intents or cleanup jobs and reconcile abandoned objects asynchronously.
   - Pros: Can recover from transient cleanup failures and provides operational traceability.
   - Cons: Requires persistence, scheduling, retry policy, and monitoring well beyond issue #318; a database outage can also prevent recording the cleanup job.
   - Effort: High

### Recommendation
Use the compensating Storage delete as a local saga. After a successful upload, treat the new path as provisional until the `service_uploads` upsert succeeds. On upsert failure, call `remove([newPath])`, preserve the existing row and old object, and reject the request. If cleanup also fails, return an error that retains both the database and cleanup failures so the orphan risk is explicit rather than silently hidden. Add a strict-TDD Supabase-mode test first for the failed-upsert path; also protect the successful replacement ordering so the old object is deleted only after the row points to the new path.

This approach fixes the reported consistency gap without changing database schema or client-facing behavior. The proposal/spec should describe observable guarantees as compensation rather than claiming impossible atomicity between Postgres and Storage.

### Risks
- Supabase Storage cleanup can fail independently; the implementation must not claim atomicity or swallow that second failure.
- Cleanup must target only the newly uploaded path. Removing `oldPath` on a failed upsert would destroy the file still referenced by the valid database row.
- Existing tests lack a reusable full Supabase Storage/query mock, so the focused test setup must model the fluent query sequence accurately without broad test refactoring.
- Other upload functions in `src/lib/data/documents.ts` have similar upload-before-insert sequencing, but expanding this change beyond service documents would be scope creep unless separately authorized.

### Ready for Proposal
Yes. The proposal should scope issue #318 to compensating cleanup in `uploadServiceDocument`, strict-TDD coverage for database and cleanup failure paths, preservation of the prior upload during replacement, and no schema or UI changes.
