-- Add admin-only write path for `profiles.features` (issue #304 / PR 2).
--
-- Background: the original `profiles_admin_read_all` policy from
-- 20260916170000_account_profiles.sql was dropped in
-- 20260917100000_fix_profiles_rls_recursion.sql because its self-join
-- (`select … from profiles … where role = 'admin'`) triggered
-- "infinite recursion detected in policy" (the inner select is itself
-- RLS-subject, and `profiles` has `force row level security`).
--
-- This migration re-establishes admin read-all and adds admin-only
-- `features` writes via a SECURITY DEFINER helper that bypasses row-level
-- security for its single `profiles` lookup. The helper's `set row_security
-- = off` is the mechanism that lets the function body read profiles without
-- re-entering RLS.
--
-- Threat model:
--   a) Only admins may update a profile's features. The policy's `using`
--      and `with check` both gate on `is_admin_account()`; the column grant
--      is scoped to `(features, updated_at)` only.
--   b) Agents cannot self-elevate: the same policy denies their update.
--   c) Unknown feature strings are dropped at the data layer
--      (filterFeatures in src/lib/data/profiles.ts) before reaching the DB.
--
-- Rollback:
--   drop policy "profiles_admin_read_all" on profiles;
--   drop policy "profiles_admin_update_features" on profiles;
--   revoke update(features, updated_at) on profiles from authenticated;
-- Existing rows are untouched because this migration never writes them
-- unless an admin edits features.

-- Recursion-free admin check. SECURITY DEFINER + `set row_security = off`
-- lets the body SELECT from `profiles` without re-entering RLS (which is
-- what caused the original "infinite recursion" in profiles_admin_read_all).
create or replace function public.is_admin_account()
returns boolean
language sql
security definer
set search_path = public, pg_temp
set row_security = off
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Admin read-all (used by listProfiles). Restored using the helper,
-- NOT a self-join to profiles.
create policy "profiles_admin_read_all" on profiles
  for select
  to authenticated
  using (public.is_admin_account());

-- Admin-only update of another profile's features. Both `using` and
-- `with check` gate on the helper so an agent attempting the same UPDATE
-- is denied at RLS (defense in depth alongside the column-scoped grant).
create policy "profiles_admin_update_features" on profiles
  for update
  to authenticated
  using (public.is_admin_account())
  with check (public.is_admin_account());

-- Column-scoped grant: authenticated may update ONLY `features` and
-- `updated_at`. No broad `grant update on profiles`, no `to anon` grant.
-- The policy above is what actually authorizes the operation; the grant
-- only governs which columns authenticated can address.
grant update (features, updated_at) on profiles to authenticated;
