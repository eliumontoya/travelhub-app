# Tasks: Centralizar helpers de autorización server-side (issue #283)

Finish the adoption of the existing authorization helpers: one shared
account-resolution path, a canonical authenticated-user entry point
(`requireUser()`), a non-throwing admin predicate for typed-error actions
(`isCurrentUserAdmin()`), and explicit `requireRole` guards on every
currently-unguarded dashboard Server Action family. Pages keep redirect-style
guards; no user-visible behavior changes.

Strict TDD is enabled (`openspec/config.yaml`: `strict_tdd: true`, unit runner
Vitest). Each concern is RED (write the failing test) → GREEN (implement) →
verify, and every phase is independently reviewable. The unit command is
`npx vitest run <path>`; `npm test` runs the full suite.

---

## Phase 1: Helper foundation (RED → GREEN)

- [x] 1.1 **RED** — Create `src/lib/__tests__/profile.test.ts` for the pure resolver: `normalizeRole("admin")` → `"admin"`, `normalizeRole("agent")` → `"agent"`, `normalizeRole("bogus")`/`normalizeRole(null)` → `null`; `resolveAccountProfile(fakeClient, "user-1")` maps `travel_agent_id` → `travelAgentId`, drops unknown feature strings while keeping recognized ones, returns `null` on a missing row, and returns `null` when the persisted role is unrecognized. Mock the client with the `from/select/eq/single` chain idiom used in `src/lib/__tests__/roles.test.ts`. Verification: `npx vitest run src/lib/__tests__/profile.test.ts` fails RED (module `@/lib/auth/profile` does not exist).
- [x] 1.2 **GREEN** — Create `src/lib/auth/profile.ts` exporting `normalizeRole(value): AccountRole | null` and `resolveAccountProfile(client, userId): Promise<AccountProfile | null>` (select `id, role, features, travel_agent_id` from `profiles`, normalize role, apply `filterFeatures` from `@/lib/auth/features`, map `travel_agent_id` → `travelAgentId`). Import only `@/lib/auth/features` and `@/types` — no `next/headers`, no `next/navigation`. Verification: `npx vitest run src/lib/__tests__/profile.test.ts` passes.
- [x] 1.3 **RED** — Extend `src/lib/__tests__/roles.test.ts`: `getCurrentUser()` returns the user when a session exists and `null` without one; `requireUser()` resolves the user and throws `Error("Unauthorized")` when there is no session; `isCurrentUserAdmin()` is `true` for an admin profile, `false` for an agent profile, and `false` (without throwing) when no account resolves; `getCurrentAccount()` still returns the mapped profile (existing assertions stay green). Verification: `npx vitest run src/lib/__tests__/roles.test.ts` fails RED on the new cases.
- [x] 1.4 **GREEN** — Modify `src/lib/auth/roles.ts`: import `normalizeRole`/`resolveAccountProfile` from `./profile` and re-export `normalizeRole`; rewrite `getCurrentAccount()` to `getUser()` → `resolveAccountProfile(supabase, user.id)` (drop the duplicated inline query and inline role normalization); add `getCurrentUser()`, `requireUser()` (throws `Error("Unauthorized")`), and `isCurrentUserAdmin()` (`(await getCurrentAccount())?.role === "admin"`). Leave `hasRole`, `canAccessFeature`, `getCurrentUserRole`, `getCurrentTravelAgentId`, `requireRole`, `requireFeature`, `requireAdmin` unchanged. Verification: `npx vitest run src/lib/__tests__/roles.test.ts src/lib/__tests__/profile.test.ts` passes.
- [x] 1.5 **Verify** — `npx tsc --noEmit` passes.

## Phase 2: Shared resolution and identity adoption (RED → GREEN)

- [x] 2.1 **RED** — Extend `src/lib/__tests__/supabase-middleware.test.ts`: `updateSession` resolves the role through `resolveAccountProfile` (mock `@/lib/auth/profile` and assert it is called with the authenticated user id), returns the same `{ response, user, role }` shape, keeps `role: null` for an unrecognized persisted role, and keeps `role: null` when Supabase is unconfigured. Verification: `npx vitest run src/lib/__tests__/supabase-middleware.test.ts` fails RED.
- [x] 2.2 **GREEN** — Modify `src/lib/supabase/middleware.ts`: replace the inline `profiles` select + role if-statement with `const account = user ? await resolveAccountProfile(supabase, user.id) : null; const role = account?.role ?? null;`. Do NOT change the returned shape. Do NOT touch `src/middleware.ts`. Verification: `npx vitest run src/lib/__tests__/supabase-middleware.test.ts` passes.
- [x] 2.3 **RED** — Update `src/app/dashboard/__tests__/layout.test.tsx`: mock `getCurrentUser` from `@/lib/auth/roles` and assert the layout renders the session email without the layout calling `createClient().auth.getUser()` directly (the raw `@/lib/supabase/server` `createClient` mock must not be invoked for identity). Verification: `npx vitest run src/app/dashboard/__tests__/layout.test.tsx` fails RED.
- [x] 2.4 **GREEN** — Modify `src/app/dashboard/layout.tsx`: replace the `isSupabaseConfigured()` + `createClient()` + `auth.getUser()` identity block (lines ~20-26) with `const user = await getCurrentUser(); const email = user?.email ?? null;`. Keep `getCurrentUserRole()`/`isAdmin` and all data loads unchanged. Verification: `npx vitest run src/app/dashboard/__tests__/layout.test.tsx` passes; `npx tsc --noEmit` passes.
- [x] 2.5 **Verify** — `npx vitest run src/lib/__tests__/supabase-middleware.test.ts src/app/dashboard/__tests__/layout.test.tsx` passes; grep confirms no remaining inline `auth.getUser()` in `src/app/dashboard/**` (only `roles.ts`'s `getCurrentUser` around it, plus login and middleware).

## Phase 3: Typed-error action uses the predicate (RED → GREEN)

- [x] 3.1 **RED** — Update `src/app/dashboard/settings/accounts/__tests__/actions.test.ts`: mock `isCurrentUserAdmin` from `@/lib/auth/roles`; a non-admin caller returns exactly `{ ok: false, error: "No autorizado." }` and `updateProfileFeatures` is NOT called; an admin caller calls `updateProfileFeatures`, triggers `revalidatePath`, and returns `{ ok: true }`; a thrown write error returns `{ ok: false, error: "Error al guardar los permisos." }`. Verification: `npx vitest run src/app/dashboard/settings/accounts/__tests__/actions.test.ts` fails RED.
- [x] 3.2 **GREEN** — Modify `src/app/dashboard/settings/accounts/actions.ts`: replace `getCurrentAccount()` + `account?.role !== "admin"` with `if (!(await isCurrentUserAdmin())) return { ok: false, error: "No autorizado." };`. Message, union, and write path unchanged. Verification: `npx vitest run src/app/dashboard/settings/accounts/__tests__/actions.test.ts` passes.
- [x] 3.3 **Verify** — `npx tsc --noEmit` passes.

## Phase 4: Guard the unguarded action families (one group per family, RED → GREEN)

For each family: write the RED test first (mock `@/lib/auth/roles` so `requireRole` rejects for an unauthorized caller, then assert the action throws and the data function is NOT called), add the guard, then verify. The guard is `await requireRole("admin", "agent");` as the FIRST statement of each exported action, before any `formData` parsing.

- [x] 4.1 **clients** — Create `src/app/dashboard/clients/__tests__/actions.test.ts` (RED) and add the guard to `createClientAction` and `deleteClientAction` in `src/app/dashboard/clients/actions.ts` (GREEN). Verify: `npx vitest run src/app/dashboard/clients/__tests__/actions.test.ts` passes.
- [x] 4.2 **clients/[id]** — Create `src/app/dashboard/clients/[id]/__tests__/actions.test.ts` (RED) and add the guard to all 8 exports in `src/app/dashboard/clients/[id]/actions.ts` (GREEN). Verify: `npx vitest run "src/app/dashboard/clients/[id]/__tests__/actions.test.ts"` passes.
- [x] 4.3 **suppliers** — Create `src/app/dashboard/suppliers/__tests__/actions.test.ts` (RED) and add the guard to all 5 exports in `src/app/dashboard/suppliers/actions.ts` (GREEN). Verify: `npx vitest run src/app/dashboard/suppliers/__tests__/actions.test.ts` passes.
- [x] 4.4 **travel-agents** — Create `src/app/dashboard/travel-agents/__tests__/actions.test.ts` (RED) and add the guard to all 3 exports in `src/app/dashboard/travel-agents/actions.ts` (GREEN). Verify: `npx vitest run src/app/dashboard/travel-agents/__tests__/actions.test.ts` passes.
- [x] 4.5 **trips/new** — Create `src/app/dashboard/trips/new/__tests__/actions.test.ts` (RED) and add the guard to `createTripAction` in `src/app/dashboard/trips/new/actions.ts` (GREEN). Verify: `npx vitest run src/app/dashboard/trips/new/__tests__/actions.test.ts` passes.
- [x] 4.6 **dashboard status actions** — Create `src/app/dashboard/__tests__/status-actions.test.ts` (RED) and add the guard to `moveTripStatusAction` and `bulkUpdateTripStatusAction` in `src/app/dashboard/actions.ts` (GREEN). Verify: `npx vitest run src/app/dashboard/__tests__/status-actions.test.ts` passes.
- [x] 4.7 **wcc/knowledge** — Create `src/app/dashboard/wcc/knowledge/__tests__/actions.test.ts` (RED) and add the guard to all 3 exports in `src/app/dashboard/wcc/knowledge/actions.ts` (GREEN). Verify: `npx vitest run src/app/dashboard/wcc/knowledge/__tests__/actions.test.ts` passes.
- [x] 4.8 **settings** — Extend `src/app/dashboard/settings/__tests__/actions.test.ts` (RED) with an unauthorized-caller case for `updateSettingsAction`, and assert `signOutAction` still runs with NO role check when the account has no role (GREEN: add the guard only to `updateSettingsAction`, leave `signOutAction` untouched). Verify: `npx vitest run src/app/dashboard/settings/__tests__/actions.test.ts` passes.
- [x] 4.9 **trips/[id]** — Extend `src/app/dashboard/trips/[id]/__tests__/actions.test.ts` (RED): assert representative trip detail mutations (`addDayAction`, `editItemAction`, `deleteTripAction`, `uploadTripPhotoAction`, `duplicateTripAction`, plus the already-guarded `getServiceChecklistForTripAction` and an action routed through `assertServiceDocumentMutableTrip`) reject an unauthenticated / wrong-role caller and mutate nothing, including when the trip is editable so `assertTripEditable` would pass. Then add `await requireRole("admin", "agent");` as the first statement of the ~46 exported actions that lack it in `src/app/dashboard/trips/[id]/actions.ts` (GREEN); leave `assertTripEditable` untouched as an editability check. Verify: `npx vitest run "src/app/dashboard/trips/[id]/__tests__/actions.test.ts"` passes.
- [x] 4.10 **Verify** — grep confirms `requireRole("admin", "agent")` is present in every file/action listed in the design table and that no dashboard action contains an inline `supabase.auth.getUser()`; `npx tsc --noEmit` passes.

## Phase 5: Documentation freshness and change-wide verification

- [x] 5.1 Update `architecture.md`: in the `Multi-cuenta y roles (profiles, travel_agents)` section, document the new helper surface (`getCurrentUser`, `requireUser`, `isCurrentUserAdmin`), the shared `src/lib/auth/profile.ts` resolver, and the enforcement contract (throw-style in Server Actions/Route Handlers; redirect-style in Server Components/pages). Update the `src/middleware.ts` bullet to state it is a role-only navigation gate and not the Server Action boundary.
- [x] 5.2 Check the README truth-source table and confirm which documents aged: `Changes.md` is NOT updated (no user-visible behavior change); `project.md`, `PRODUCT.md`, `DESIGN.md`, `doc/adr/`, and `doc/whatsapp-inbound-agent-architecture.md` are unaffected. Record the check in the PR description.
- [x] 5.3 **Final verification** — `npx tsc --noEmit` passes; `npm run lint` passes; `npm test` (full Vitest suite) passes; `npm run build` succeeds without a client bundle importing a server-only helper.
- [x] 5.4 Confirm the spec scenarios are covered by tests: helper enforcement style, `requireUser` throw, predicate behavior, shared-resolution parity (unknown role, recognized role, unknown feature filtered), each newly guarded family denying an unauthorized caller, the trip detail family denying an unauthorized caller even when `assertTripEditable` would pass, guarded action running for a valid agent, and `signOutAction` remaining callable without a role.

### Deferred (out of scope — do not implement here)

- Feature-level per-action enforcement for actions inside feature areas.
- Request-scoped caching to avoid the double account fetch (page guard + action guard).

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~840 (range 700–1000, including the 48-action trips/[id] family and its extended tests) |
| 400-line budget risk | High |
| 800-line budget risk | Medium |
| Chained PRs recommended | No |
| Delivery strategy | single-pr |
| Chain strategy | N/A (single PR) |

```
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: N/A (single PR)
400-line budget risk: High
```

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test | Runtime harness | Rollback boundary |
|------|------|-----------|--------------|-----------------|-------------------|
| 1 | Helper foundation + shared resolver (Phases 1–2) | PR 1 | `npx vitest run src/lib/__tests__/profile.test.ts src/lib/__tests__/roles.test.ts src/lib/__tests__/supabase-middleware.test.ts src/app/dashboard/__tests__/layout.test.tsx` | `npx tsc --noEmit`; mocked suites (no Supabase env needed) | Delete `src/lib/auth/profile.ts`; revert `src/lib/auth/roles.ts`, `src/lib/supabase/middleware.ts`, `src/app/dashboard/layout.tsx`. No schema change. |
| 2 | Typed-error predicate adoption (Phase 3) | PR 2 | `npx vitest run src/app/dashboard/settings/accounts/__tests__/actions.test.ts` | `npx tsc --noEmit` | Revert `src/app/dashboard/settings/accounts/actions.ts` and its test. |
| 3 | Action family guards (Phase 4) | PR 3 | `npx vitest run src/app/dashboard/clients src/app/dashboard/suppliers src/app/dashboard/travel-agents src/app/dashboard/trips src/app/dashboard/wcc/knowledge src/app/dashboard/settings` | `npx tsc --noEmit` | Revert the nine `actions.ts` files and delete/revert the per-family tests. |
| 4 | Docs + final verification (Phase 5) | PR 4 | `npm test` | `npx tsc --noEmit && npm run lint && npm test && npm run build` | Revert `architecture.md`. |

Each unit is independently reviewable and reversible; chain strategy is already
decided, so no further decision is needed before apply.
