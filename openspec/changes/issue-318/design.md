# Design: Prevent Orphaned Service-Document Storage Objects

## Technical Approach

Keep the reliability boundary inside `uploadServiceDocument`, the data-layer use case that already coordinates checklist validation, Supabase Storage, and the `service_uploads` upsert. The newly uploaded path remains provisional until the database upsert succeeds. If that upsert fails, the function attempts one bounded compensating removal of that exact new path before rejecting. The previously referenced path remains untouched unless the upsert succeeds, preserving the last valid replacement during failure.

This implements the modified `One file per checklist item` requirement without claiming a transaction across Postgres and Storage. Successful compensation preserves the current error contract by throwing the original persistence error. Whether Storage reports cleanup failure through `{ error }` or by throwing/rejecting, failed compensation throws an `AggregateError` containing both provider failures and a semantic diagnostic that cleanup is incomplete and the provisional path may remain orphaned.

## Architecture Decisions

### Decision: Compensate in the existing service-document use case

**Choice**: Add the compensating removal directly around the `service_uploads` upsert in `uploadServiceDocument`.

**Alternatives considered**: Introduce a generic Storage transaction helper; add a durable cleanup queue or reconciliation worker; move the behavior into a Server Action.

**Rationale**: This failure boundary is specific to the service-upload record and its newly allocated path. Keeping the orchestration in the owning data-layer function follows the current architecture, limits the change to the requested upload flow, and avoids pretending a reusable helper can provide cross-system atomicity. Durable recovery is explicitly out of scope.

### Decision: Bound compensation to the newly uploaded path

**Choice**: On upsert failure, call `remove([path])` exactly once using the path created for the current invocation. Never use `oldPath` in the compensation branch.

**Alternatives considered**: Remove both old and new paths; remove the previous object before the upsert; retry removal or the database write.

**Rationale**: The database still references the old object when the upsert fails. Deleting it would turn a recoverable replacement failure into data loss. A single attempt is observable and bounded; retries require policy, durability, and operational ownership that this change does not introduce.

### Decision: Preserve replacement ordering

**Choice**: Retain the sequence `upload new object -> upsert row to new path -> remove old object`. The old-object removal remains reachable only after a successful upsert.

**Alternatives considered**: Delete the old object before uploading or persisting the replacement; delete old and new objects concurrently after the upsert starts.

**Rationale**: The existing row and old object form the last valid state. Advancing the row first ensures a failed upsert cannot destroy that state. This design intentionally does not change the existing best-effort handling of an old-object removal failure after a successful replacement because that is a separate contract from provisional-object compensation.

### Decision: Use thrown errors, with `AggregateError` only for dual failure

**Choice**: If compensation succeeds, throw the original database error unchanged. Treat both Storage removal failure forms—an `{ error }` result and a thrown/rejected removal call—as cleanup failures. In either dual-failure case, throw `new AggregateError([persistenceError, cleanupFailure], message)` where the message semantically states that persistence and cleanup failed, cleanup is incomplete, and the new path may remain orphaned.

**Alternatives considered**: Return a result union; replace both provider failures with a message-only `Error`; attach a custom ad hoc property to an `Error`; log the cleanup failure and throw only the database failure.

**Rationale**: Project data functions and their calling Server Action already communicate failures by rejection, so a return-type change would widen the public contract and UI scope. `AggregateError` is a standard `Error` subtype supported by the configured `esnext` library, preserves both original failure values in order, and still provides the explicit human-readable message used by existing error surfaces. A message-only error or log would discard evidence required by the specification.

## Data Flow

### Successful replacement

```text
load checklist item
        |
        v
read existing row -> oldPath P1
        |
        v
upload provisional object P2
        |
        v
upsert row to reference P2
        |
        v
remove old object P1
        |
        v
return persisted upload
```

### Failed persistence with bounded compensation

```text
upload provisional object P2
        |
        v
upsert row fails ------------------------------+
        |                                      |
        v                                      |
remove P2 once                                 | old row still references P1
   |                 |                         | P1 is never compensation target
   | success         | returned error OR       |
   |                 | thrown/rejected error   |
   v                 v                         |
throw original       throw AggregateError      |
persistence error    [persistence, cleanup] <---+
```

No branch reports a successful upload after the database upsert fails. Neither compensation outcome is described as an atomic rollback.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/data/services.ts` | Modify | Add the bounded compensation branch and dual-error rejection while preserving successful replacement ordering. |
| `src/lib/data/__tests__/services.test.ts` | Modify | Add focused Supabase-mode RED tests for compensation, old-object preservation, dual failure, and successful ordering. |

No schema, migration, type, UI, Server Action, or other upload-flow file changes are required.

## Interfaces / Contracts

`uploadServiceDocument(serviceId, checklistItemId, file): Promise<ServiceUpload>` keeps its signature and success value.

Failure behavior after the Storage upload succeeds is:

```typescript
if (persistenceError) {
  let cleanupFailed = false;
  let cleanupFailure: unknown;

  try {
    const { error } = await storage.remove([newPath]);
    if (error) {
      cleanupFailed = true;
      cleanupFailure = error;
    }
  } catch (error) {
    cleanupFailed = true;
    cleanupFailure = error;
  }

  if (cleanupFailed) {
    throw new AggregateError(
      [persistenceError, cleanupFailure],
      `Persistence failed and cleanup is incomplete; ${newPath} may remain orphaned.`
    );
  }

  throw persistenceError;
}
```

The snippet defines control flow and semantic diagnostics, not mandatory final wording or local variable names. Production wording should follow the existing data-layer language convention. The implementation MUST preserve these invariants:

- `remove` receives only the current invocation's new path in the persistence-failure branch.
- The previous path is not removed unless the upsert succeeds.
- A successful compensating removal does not replace or wrap the original persistence failure.
- Both a returned Storage removal error and a thrown/rejected Storage removal call produce an `AggregateError` whose `errors` array retains `[persistenceError, cleanupFailure]` in causal order.
- The aggregate message explicitly identifies incomplete cleanup and the orphan risk for the provisional path.
- The function never returns `ServiceUpload` after a failed upsert.

The existing mock-mode behavior is unchanged because it does not cross independent Storage and database systems.

## Testing Strategy

Strict TDD is mandatory, using `npm run test` as the test runner.

### RED

Extend `src/lib/data/__tests__/services.test.ts` with a focused Supabase client double that records Storage `upload`/`remove` calls and controls the existing-row lookup and upsert result. Add failing tests before production changes:

1. A first-upload upsert failure removes only the generated provisional path and rejects with the original persistence error when cleanup succeeds.
2. A replacement upsert failure removes only P2, never removes P1, and rejects while the pre-existing database state remains represented by P1.
3. A compensation call that returns `{ error: cleanupError }` rejects with `AggregateError`, preserves `[persistenceError, cleanupError]` in causal order, and semantically identifies incomplete cleanup, orphan risk, and P2 without freezing incidental message wording.
4. A compensation call that throws or rejects with `cleanupError` also rejects with `AggregateError`, preserves `[persistenceError, cleanupError]` in causal order, and semantically identifies incomplete cleanup, orphan risk, and P2.
5. A successful replacement records that the row upsert completes before `remove([P1])`, never compensates P2, and returns the persisted P2 row.

Use controlled time or capture the path passed to `storage.upload` rather than asserting a wall-clock timestamp. For dual-error diagnostics, inspect the `AggregateError.errors` entries and match semantic message fragments plus the provisional path instead of asserting a complete localized sentence. Assertions should prove exact removal targets and event order, not duplicate Supabase client internals beyond the fluent chain required by the use case.

### GREEN

Implement the smallest compensation branch in `uploadServiceDocument` that makes the focused tests pass. Run the focused service-data test file first, then run the full required suite with `npm run test`.

### REFACTOR

Remove unnecessary mock complexity and keep the production branch linear and local. Re-run the focused tests and `npm run test`; also run `npx tsc --noEmit` to confirm the standard error type and Supabase response handling remain type-safe.

| Layer | What to Test | Approach |
|-------|--------------|----------|
| Unit/data-layer | Exact compensation target, original-error propagation, dual-error aggregation, and replacement ordering | Vitest with a focused Supabase fluent-query and Storage double in `services.test.ts` |
| Integration | Existing service data behavior across the repository | Full `npm run test` suite after GREEN and REFACTOR |
| E2E | N/A | No UI or route behavior changes; deterministic failure injection belongs at the data-layer boundary |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration or feature flag is required. Deploy as a backward-compatible data-layer reliability fix. Rollback is a code revert of the compensation branch and its focused tests; objects orphaned before deployment or after a failed compensation remain outside this change's guarantees.

## Open Questions

None.
