-- Fix: grant SELECT on profiles to anon role.
--
-- The middleware uses supabaseAnonKey to create the server client.
-- Even though authenticated users operate under the `authenticated` role,
-- the initial connection requires the `anon` role to have SELECT privilege.
-- RLS (profiles_self_read) still ensures users can only read their own profile.

grant select on profiles to anon;
