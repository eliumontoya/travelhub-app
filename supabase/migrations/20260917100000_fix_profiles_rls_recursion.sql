-- Fix: drop the recursive admin-read-all policy on profiles.
--
-- The policy "profiles_admin_read_all" caused "infinite recursion detected in policy"
-- because it SELECTed from the same `profiles` table to check if the user is admin,
-- and that inner SELECT was also subject to RLS.
--
-- The middleware only needs to read the current user's own profile, which is covered
-- by the "profiles_self_read" policy (auth.uid() = id). The admin-read-all policy
-- can be re-added later using a SECURITY DEFINER function if needed.

drop policy if exists "profiles_admin_read_all" on profiles;
