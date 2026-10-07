import { defineConfig, devices } from "@playwright/test";

// Playwright 1.62 does not yet expose `default` on the Project type, but the
// design reserves it as the opt-in marker for non-default projects. Declare
// the field so the intent is type-safe; the corresponding `test:e2e` script
// is pinned to `--project=local` so preview does not run by default today.
declare module "@playwright/test" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Project {
    default?: boolean;
  }
}

// The `local` project runs against the local server backed by the seeded
// Supabase CLI stack (issue #372). These are the standard, public local demo
// keys emitted by `supabase start`; they are safe to commit and are only used
// by the local server started below (dev locally, production in CI). Override
// the env vars to point at a different local stack.
const LOCAL_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const LOCAL_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
// The admin/service-role key is required server-side for the client portal
// (PIN verification) and the traveler-activity RPCs.
const LOCAL_SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// `local` project runs against the local server (dev server when run
// locally, production server in CI — see the `webServer` block below) with
// local Supabase env wired into the `webServer` block. `preview` project runs
// against the deployed
// Vercel preview URL supplied via BASE_URL. The presence of BASE_URL also
// disables the top-level webServer so the preview job does not start a
// redundant local server.
const hasRemoteTarget = !!process.env.BASE_URL;
const bypassToken = process.env.VERCEL_PROTECTION_BYPASS || "";

export default defineConfig({
  // Best-effort route warmup so the first test does not race the server's
  // first-request cost (dev-server compilation locally; production warmup in
  // CI, issue #409).
  // before the first test starts (issue #406).
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Retries are safe because the specs are idempotent since issue #406: each
  // spec restores the state it owns in `beforeEach`, uses per-run unique
  // names, and tears its own rows down in `afterAll`, so an attempt starts
  // from seed-equivalent state instead of stacking residual data.
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "html" : "list",
  timeout: 30_000,
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "local",
      testDir: "e2e/local",
      // Serial: specs share the seeded trip/client state and mutate it
      // (publishing, assignments, checklist counts), so parallel files would
      // race on the same rows.
      workers: 1,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:3000",
      },
    },
    {
      name: "preview",
      testDir: "e2e/preview",
      default: false,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env.BASE_URL || "http://localhost:3000",
        extraHTTPHeaders: bypassToken
          ? { "x-vercel-protection-bypass": bypassToken }
          : {},
      },
    },
  ],
  webServer: hasRemoteTarget
    ? undefined
    : {
        // In CI the suite runs against a production server (`next build &&
        // next start`, built by the workflow before this config loads). The
        // dev server under a cold CI runner delays or aborts server actions
        // (`destination stream closed early`), producing flaky assertions and
        // late mutations that race retry restorations (issue #409). Local
        // runs keep `next dev` for fast iteration.
        command: process.env.CI ? "npm run start" : "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          NEXT_PUBLIC_SUPABASE_URL: LOCAL_SUPABASE_URL,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: LOCAL_SUPABASE_ANON_KEY,
          SUPABASE_SERVICE_ROLE_KEY: LOCAL_SUPABASE_SERVICE_ROLE_KEY,
        },
      },
});
