import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Test database helpers — issue #372 phase 2 (migrating unit tests off the
 * legacy in-memory mock data store).
 *
 * There are two supported migration patterns. Pick the lightest one that can
 * actually prove the behavior under test.
 *
 * ── Pattern (a): contract test with a mocked Supabase client (default) ──
 * Mock `@/lib/supabase/server` and force `isSupabaseConfigured()` to `true`, so
 * the real data module runs its Supabase branch against a small hand-written
 * fake client. Assert the exact `.from()/.select()/.eq()/.order()` query shape
 * and the row mapper output. This is the default: fast, hermetic, and enough to
 * pin persistence/read/update/delete call contracts.
 *
 * ```ts
 * const fake = vi.hoisted(() => ({ calls: [] as unknown[], client: { from: ... } }));
 *
 * vi.mock("@/lib/supabase/server", () => ({
 *   isSupabaseConfigured: () => true,
 *   createClient: async () => fake.client,
 * }));
 * ```
 *
 * ── Pattern (b): real-DB test against the local stack (only when needed) ──
 * Use `getTestSupabaseClient()` to talk to the local Supabase stack started
 * with `supabase start`. Reserve this for semantics a mocked client cannot
 * prove, e.g. real foreign-key cascades. The client uses the service role key
 * so RLS does not mask the behavior under test.
 *
 * ```ts
 * import { getTestSupabaseClient } from "@/lib/__tests__/helpers/db";
 * const supabase = getTestSupabaseClient();
 * const { data, error } = await supabase.from("trips").select("*");
 * ```
 *
 * Local stack defaults come from `supabase status`; `TEST_SUPABASE_URL` and
 * `TEST_SUPABASE_SERVICE_ROLE_KEY` override them so CI can point elsewhere.
 */

// Local Supabase CLI defaults (see `supabase status`). These are the public
// local-only demo credentials printed by the CLI, never production secrets.
const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const LOCAL_SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

/**
 * Service-role Supabase client pointed at the local test stack (pattern b).
 * Only import this from real-DB tests; mocked-contract tests (pattern a) must
 * not depend on a running database.
 */
export function getTestSupabaseClient(): SupabaseClient {
  const url = process.env.TEST_SUPABASE_URL ?? LOCAL_SUPABASE_URL;
  const serviceRoleKey =
    process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? LOCAL_SUPABASE_SERVICE_ROLE_KEY;

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
