# Tasks: Per-agent feature system in the dashboard (issue #304)

Wires the existing `profiles.features[]` model (issue #300) into consumption and enforcement: a typed 6-feature catalog, per-feature nav gating, server-side `requireFeature` guards on all 6 gated routes, an admin profiles write path with a recursion-free Supabase RLS migration, and an admin UI at `/dashboard/settings/accounts`.

Strict TDD is enabled (`openspec/config.yaml`: `strict_tdd: true`, unit runner Vitest). Every concern follows RED (write failing test) → GREEN (implement) → verify. Tasks are grouped by phase and ordered by dependency.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~840 (additions + deletions, generated files excluded) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Phases 1–4) → PR 2 (Phases 5–6) → PR 3 (Phase 7) |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

```
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High
```

> **Chain strategy is `pending`**: none is cached, and `auto-chain` requires a missing strategy to be resolved before the first PR is opened. The orchestrator MUST ask the user to choose **stacked-to-main** or **feature-branch-chain** before apply (per `chained-pr` skill). Slices below are strategy-agnostic work units.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Feature model + enforcement: typed catalog (`Feature`, `features.ts`), guards (`canAccessFeature`/`requireFeature`/`requireAdmin`), nav gating, and the 6 gated route guards. Delivers: agents see and reach only assigned features; admins unaffected. | PR 1 | `npx vitest run src/lib/__tests__/features.test.ts src/lib/__tests__/roles.test.ts` then `npx tsc --noEmit` | `npm run dev`; set cookie `x-mock-account-id=mock-agent`, assert nav shows only Dashboard/Viajes/Clientes and `curl -s -o /dev/null -w "%{http_code} %{redirect_url}" -H "Cookie: x-mock-account-id=mock-agent" http://localhost:3000/dashboard/settings` returns 307 → `/dashboard` | Revert `src/app/dashboard/layout.tsx` to `getCurrentUserRole`+`isAdmin`; remove the six `requireFeature` calls; revert `src/types/index.ts` and `src/lib/auth/roles.ts`; delete `src/lib/auth/features.ts`; restore `mock-agent` features in `src/lib/mock-data.ts`. No schema change. |
| 2 | Profiles write path + RLS migration: `listProfiles`/`updateProfileFeatures` (dual-mode), re-export, recursion-free SECURITY DEFINER migration with column-scoped update grant. Delivers: admin-only read/write of profile features at the data and DB layer. | PR 2 | `npx vitest run src/lib/__tests__/profiles.test.ts src/lib/__tests__/profiles-admin-update-migration.test.ts` then `npx tsc --noEmit` | Apply `supabase/migrations/20260924000000_profiles_admin_update.sql` to a Supabase project; as an agent run `update profiles set features = ...` → denied; as admin → succeeds. If no Supabase env is available, mark the live check `N/A` (covered by migration-shape test + server-action admin re-check in Unit 3) and flag it in the PR. | `drop policy "profiles_admin_read_all" on profiles; drop policy "profiles_admin_update_features" on profiles; revoke update(features, updated_at) on profiles from authenticated;` + delete `src/lib/data/profiles.ts` and the re-export line in `src/lib/data.ts`. |
| 3 | Admin UI: `requireAdmin()` page at `/dashboard/settings/accounts`, server action `updateProfileFeaturesAction`, client toggle UI, admin-only "Cuentas" nav link. Delivers: admins assign features without SQL. | PR 3 | `npx vitest run src/app/dashboard/settings/accounts/__tests__/actions.test.ts` then `npx tsc --noEmit` | `npm run dev` as `mock-admin` → open `/dashboard/settings/accounts` → toggle `mock-agent` features → next-request nav gating reflects the change (mock write-path round trip). | Delete `src/app/dashboard/settings/accounts/` and remove the admin-only "Cuentas" link from `src/app/dashboard/layout.tsx`. |

Chain note: PR 1 already edits `layout.tsx` (feature-gated nav) and PR 3 edits it again (Cuentas link). With `feature-branch-chain` each child diff is against the immediate previous branch, so both diffs stay clean; with `stacked-to-main` PR 3 rebases after PR 1 merges. If either child PR shows the previous slice's changes, retarget/rebase before review.

---

## Phase 1: Foundation — Feature catalog & types (RED → GREEN)

- [ ] 1.1 **RED** — Create `src/lib/__tests__/features.test.ts`: asserts `AVAILABLE_FEATURES` contains exactly `["trips", "clients", "suppliers", "travel-agents", "whatsapp", "settings"]` in that order; `FEATURE_DEFINITIONS` maps `whatsapp → /dashboard/wcc` and `travel-agents → /dashboard/travel-agents` plus the other four hrefs/labels (`Viajes`, `Clientes`, `Proveedores`, `Agentes`, `WhatsApp C.C.`, `Ajustes`); `isFeature` narrows known values and rejects unknown/null; `filterFeatures` drops unknown strings and preserves recognized ones. Verification: `npx vitest run src/lib/__tests__/features.test.ts` fails RED (module `@/lib/auth/features` does not exist).
- [ ] 1.2 **RED** — Extend `src/lib/__tests__/roles.test.ts` with the tightened typed `canAccessFeature(profile, feature: Feature)` matrix: admin → `true` for every feature regardless of assignment; agent → `true` only for assigned features; `null` profile → `false`. Reference `src/lib/auth/roles.ts` (read-only) and `src/types/index.ts` (read-only). Verification: file typechecks against current `string`-typed signature only after 1.3; run `npx vitest run src/lib/__tests__/roles.test.ts` and record the RED (compile or assertion) result.
- [ ] 1.3 **GREEN** — Modify `src/types/index.ts`: add `export type Feature = "trips" | "clients" | "suppliers" | "travel-agents" | "whatsapp" | "settings";` and change `AccountProfile.features` from `string[]` to `Feature[]`. Fix any consumer type errors surfaced by `npx tsc --noEmit`.
- [ ] 1.4 **GREEN** — Create `src/lib/auth/features.ts`: `AVAILABLE_FEATURES: Feature[]`, `FEATURE_DEFINITIONS: readonly FeatureDefinition[]` (`{ feature, href, label }` — hrefs `/dashboard/trips`, `/dashboard/clients`, `/dashboard/suppliers`, `/dashboard/travel-agents`, `/dashboard/wcc`, `/dashboard/settings`), `isFeature(value): value is Feature`, `filterFeatures(values: unknown): Feature[]`. Zero server-only imports (only `@/types`) so the admin client component can import it.
- [ ] 1.5 **GREEN** — Modify `src/lib/mock-data.ts`: change `mockProfiles["mock-agent"].features` from `["trips"]` to `["trips", "clients"]` (two granted, four denied — exercises both show/allow and hide/redirect paths).
- [ ] 1.6 **Verify** — `npx vitest run src/lib/__tests__/features.test.ts src/lib/__tests__/roles.test.ts` passes; `npx tsc --noEmit` passes.

## Phase 2: Access guards in `roles.ts` (RED → GREEN)

- [ ] 2.1 **RED** — Extend `src/lib/__tests__/roles.test.ts` (edit target) with: `requireFeature("trips")` admin passes and returns the account; agent with `trips` assigned passes; agent without the feature → `redirect("/dashboard")` called (mock `next/navigation`); null account → `redirect("/dashboard")`; `requireAdmin()` admin passes, agent → `redirect("/dashboard")`; defensive filtering in `getCurrentAccount` — unknown feature strings dropped in BOTH the mock branch (profile with a stray DB string) and the Supabase branch (row `features: ["trips", "bogus"]` → `["trips"]`); `resolveMockAccountId()` reads the `x-mock-account-id` cookie (mock `next/headers`). Reference `src/lib/auth/roles.ts` (read-only). Verification: new tests fail RED (functions absent / filtering not applied).
- [ ] 2.2 **GREEN** — Modify `src/lib/auth/roles.ts`: import `{ redirect } from "next/navigation"` and `{ filterFeatures } from "@/lib/auth/features"`; export `const MOCK_ACCOUNT_COOKIE = "x-mock-account-id"`; add `resolveMockAccountId(mockAccountId?)` (reads the cookie when no explicit id); tighten `canAccessFeature(profile, feature: Feature)`; add `requireFeature(feature: Feature, mockAccountId?)` and `requireAdmin(mockAccountId?)` — both `redirect("/dashboard")` on denial, return the resolved `AccountProfile` on success; apply `filterFeatures` to `features` in both branches of `getCurrentAccount` (mock returns a filtered copy, Supabase maps `filterFeatures(data.features)`).
- [ ] 2.3 **Verify** — `npx vitest run src/lib/__tests__/roles.test.ts` passes; `npx tsc --noEmit` passes.

## Phase 3: Nav gating in the dashboard layout (GREEN + verify)

- [ ] 3.1 **GREEN** — Modify `src/app/dashboard/layout.tsx`: replace `getCurrentUserRole(mockAccountId)` + `isAdmin` with `getCurrentAccount(await resolveMockAccountId())`; render the six feature links from `FEATURE_DEFINITIONS`, each guarded by `canAccessFeature(account, def.feature)`; keep the Dashboard home link unconditional; drop the local `MOCK_ACCOUNT_COOKIE` constant in favor of the exported one from `@/lib/auth/roles`. Do NOT add the "Cuentas" link here (it ships with the admin UI in 7.5). CommandPalette data load (`getClients`/`getTripsWithClients`) stays unchanged (out of scope, flagged in proposal risks).
- [ ] 3.2 **Verify** — `npx tsc --noEmit` and `npm run test` pass; runtime harness: `npm run dev`, set `x-mock-account-id=mock-agent`, confirm nav shows only Dashboard/Viajes/Clientes; set `mock-admin`, confirm all six links visible.

## Phase 4: Route-level guards on the 6 gated routes (GREEN + verify)

Apply `await requireFeature("<feature>");` as the first statement of each Server Component, before any data load:

- [ ] 4.1 **GREEN** — Modify `src/app/dashboard/trips/page.tsx`: add `await requireFeature("trips");` before `parseTripsSearchParams`/data load.
- [ ] 4.2 **GREEN** — Modify `src/app/dashboard/clients/page.tsx`: add `await requireFeature("clients");` before data load.
- [ ] 4.3 **GREEN** — Modify `src/app/dashboard/suppliers/page.tsx`: add `await requireFeature("suppliers");` before data load.
- [ ] 4.4 **GREEN** — Modify `src/app/dashboard/travel-agents/page.tsx`: add `await requireFeature("travel-agents");` before `getTravelAgents()`.
- [ ] 4.5 **GREEN** — Modify `src/app/dashboard/wcc/layout.tsx` (NOT `page.tsx`): make the layout async and add `await requireFeature("whatsapp");` — this single choke point guards `/dashboard/wcc` and all sub-routes (`contacts`, `conversations`, `escalations`, `knowledge`).
- [ ] 4.6 **GREEN** — Modify `src/app/dashboard/settings/page.tsx`: add `await requireFeature("settings");` before `getSiteSettings()`.
- [ ] 4.7 **Verify** — `npx tsc --noEmit` and `npm run test` pass; runtime harness (mock): `curl -s -o /dev/null -w "%{http_code} %{redirect_url}" -H "Cookie: x-mock-account-id=mock-agent" http://localhost:3000/dashboard/settings` returns 307 → `/dashboard`; `/dashboard/trips` and `/dashboard/clients` return 200; `/dashboard/settings/accounts` is NOT guarded by the `settings` feature (see 7.x) — assert it 404s or redirects for non-admins via `requireAdmin` once Phase 7 lands.

## Phase 5: Profiles write path (RED → GREEN)

- [ ] 5.1 **RED** — Create `src/lib/__tests__/profiles.test.ts`: `listProfiles()` mock mode returns all `Object.values(mockProfiles)`; Supabase mode maps rows via `rowToProfile` (select + order assertions); `updateProfileFeatures(id, ["trips","clients"])` mock mode mutates `mockProfiles[id].features` in place and a subsequent `listProfiles()`/read reflects it; Supabase mode calls `.update({ features, updated_at }).eq("id", id).select(...).single()`; **threat case (c): an unknown feature string is NOT persisted** — mock `updateProfileFeatures(id, ["trips", "bogus"])` results in `["trips"]`. Reference `@/lib/data/profiles` (module absent → RED), `src/lib/data/shared.ts` (read-only), `src/lib/mock-data.ts` (read-only).
- [ ] 5.2 **GREEN** — Create `src/lib/data/profiles.ts` mirroring `travel-agents.ts` conventions: `rowToProfile(row)` (`id`, `role`, `features` via `filterFeatures`, `travelAgentId` from `travel_agent_id`), `listProfiles()` (mock: `[...Object.values(mockProfiles)]`; Supabase: `createServerSupabase().from("profiles").select("id, role, features, travel_agent_id").order("created_at")` mapped through `rowToProfile`), `updateProfileFeatures(id, features)` (sanitize via `filterFeatures`; mock: mutate `mockProfiles[id].features` and return the profile; Supabase: `.from("profiles").update({ features: sanitized, updated_at: new Date().toISOString() }).eq("id", id).select("id, role, features, travel_agent_id").single()`). Data layer stays role-agnostic — admin enforcement lives in the server action (7.2) and RLS (6.2).
- [ ] 5.3 **GREEN** — Modify `src/lib/data.ts`: add `export * from "@/lib/data/profiles";`.
- [ ] 5.4 **Verify** — `npx vitest run src/lib/__tests__/profiles.test.ts` passes; `npx tsc --noEmit` passes.

## Phase 6: Supabase RLS migration (RED → GREEN)

- [ ] 6.1 **RED** — Create `src/lib/__tests__/profiles-admin-update-migration.test.ts` following the `account-profiles-migration.test.ts` shape (reads the SQL file): asserts the migration contains the `SECURITY DEFINER` `is_admin_account()` helper with `set row_security = off` and `set search_path = public, pg_temp`; re-creates policy `profiles_admin_read_all` (SELECT, `using (public.is_admin_account())`); creates policy `profiles_admin_update_features` (UPDATE, both `using` and `with check` calling `is_admin_account()`); includes column-scoped `grant update(features, updated_at) on profiles to authenticated`; **threat case (a): asserts NO broad `grant update on profiles` and no `grant update on profiles to anon`**. Reference `supabase/migrations/20260924000000_profiles_admin_update.sql` (read-only — absent until 6.2, which makes this RED). Also read `supabase/migrations/20260917100000_fix_profiles_rls_recursion.sql` (read-only) to confirm the dropped-policy context.
- [ ] 6.2 **GREEN** — Create `supabase/migrations/20260924000000_profiles_admin_update.sql` exactly per design: `create or replace function public.is_admin_account() ... security definer set search_path = public, pg_temp set row_security = off stable as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;`; `create policy "profiles_admin_read_all" on profiles for select to authenticated using (public.is_admin_account());`; `create policy "profiles_admin_update_features" on profiles for update to authenticated using (public.is_admin_account()) with check (public.is_admin_account());`; `grant update(features, updated_at) on profiles to authenticated;`. Do not touch `profiles_self_read`, the anon select grant, or any existing column/data.
- [ ] 6.3 **Verify** — `npx vitest run src/lib/__tests__/profiles-admin-update-migration.test.ts` passes; functional RLS check against live Supabase at apply time (design open question: confirm `row_security = off` is honored against `force row level security`; documented fallback: `bypassrls`-owned definer or `auth.jwt()` role check). Record the result; if no Supabase env, mark live check `N/A` in the PR and flag it.

## Phase 7: Admin UI at `/dashboard/settings/accounts` (RED → GREEN)

- [ ] 7.1 **RED** — Create `src/app/dashboard/settings/accounts/__tests__/actions.test.ts` (follow the `src/app/dashboard/trips/[id]/__tests__/actions.test.ts` convention; mock `@/lib/auth/roles` and `@/lib/data/profiles`): `updateProfileFeaturesAction(id, features)` for a non-admin account returns `{ ok: false, error: "No autorizado." }` and does NOT call `updateProfileFeatures` — **threat case (b)**; for an admin account it calls `updateProfileFeatures(profileId, features)`, triggers `revalidatePath("/dashboard/settings/accounts")`, and returns `{ ok: true }`; on a thrown error it returns `{ ok: false, error: "Error al guardar los permisos." }`. Reference `src/app/dashboard/settings/accounts/actions.ts` (absent → RED), `src/lib/auth/roles.ts` (read-only).
- [ ] 7.2 **GREEN** — Create `src/app/dashboard/settings/accounts/actions.ts`: `"use server"`; `updateProfileFeaturesAction(profileId, features)` — resolve `getCurrentAccount(await resolveMockAccountId())`; if `role !== "admin"` return `{ ok: false, error: "No autorizado." }`; try `updateProfileFeatures(profileId, features)` + `revalidatePath("/dashboard/settings/accounts")` → `{ ok: true }`; catch → `{ ok: false, error: "Error al guardar los permisos." }`.
- [ ] 7.3 **GREEN** — Create `src/app/dashboard/settings/accounts/page.tsx` (Server Component): `await requireAdmin()` (non-admins redirect to `/dashboard`), `const profiles = await listProfiles()`, render `<FeatureManagerClient profiles={profiles} />`. Not gated by the `settings` feature — admin-only by role.
- [ ] 7.4 **GREEN** — Create `src/app/dashboard/settings/accounts/FeatureManagerClient.tsx` (`"use client"`): table of profiles (id, role, linked agent) with one checkbox per `FEATURE_DEFINITIONS` entry; on change compute `nextFeatures` and call `updateProfileFeaturesAction(profileId, nextFeatures)` inside `useTransition`, then `router.refresh()`. Toggle set derives solely from `FEATURE_DEFINITIONS` so the UI cannot invent features.
- [ ] 7.5 **GREEN** — Modify `src/app/dashboard/layout.tsx` (second edit, ships with this slice): add an admin-only "Cuentas" link to `/dashboard/settings/accounts`, rendered when `account?.role === "admin"` (outside the six-feature catalog — account management edits the flags, it is not a flag).
- [ ] 7.6 **Verify** — `npx vitest run src/app/dashboard/settings/accounts/__tests__/actions.test.ts` passes; `npx tsc --noEmit` passes; runtime harness (mock): `npm run dev` as `mock-admin` → open `/dashboard/settings/accounts` → toggle `mock-agent` features → confirm next-request nav reflects the change; as `mock-agent` → `GET /dashboard/settings/accounts` redirects to `/dashboard`.

## Phase 8: Change-wide verification (GREEN closure)

Run after all slices are integrated (each slice already ran its focused commands):

- [ ] 8.1 `npx tsc --noEmit` passes.
- [ ] 8.2 `npm run lint` passes.
- [ ] 8.3 `npm run test` (Vitest) passes — full suite, including the spec scenarios: fixed catalog, unknown feature discarded, agent redirected from gated route, admin passes route guard, missing account fails guard, admin sees all links, agent sees only assigned links, dashboard home always visible, admin lists profiles, non-admin denied listing, admin assigns/clears features, unknown feature not persisted, admin write succeeds under policy, agent write denied, mock update persists in memory.
- [ ] 8.4 `npm run build` passes (no client import of server-only modules — `features.ts` must stay dependency-free).
- [ ] 8.5 `npm run test:e2e` (mock suite) passes or is explicitly recorded as skipped with reason; CommandPalette leakage is out of scope and must be flagged in the PR changelog as a conscious follow-up.

## Out of scope (do not implement)

- `src/middleware.ts` / `src/lib/supabase/middleware.ts` — keep role-only check; no per-account feature loading.
- CommandPalette data scoping (proposal risk, conscious deferral).
- Per-agent row-level data filtering of trips/clients; role enumeration changes; self-service provisioning; profile CRUD beyond `features`.