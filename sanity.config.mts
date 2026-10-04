/**
 * sanity-kit configuration — deterministic quality dashboard.
 * Validated and merged by sanity-kit (defaults in sanity-kit/src/config.ts).
 * Docs: ../sanity-kit/README.md
 */
export default {
  project: "travelhub-app",
  checks: {
    types: true,
    lint: true,
    deadCode: true,
    audit: true,
    secrets: true,
    tests: true,
    coverage: {
      enabled: true,
      // Baseline ratchet (calibrated 2026-10-03 to current levels):
      // CI fails only if coverage drops below these; raise as it improves.
      minLines: 50,
      minBranches: 40,
      minFunctions: 50,
      minStatements: 48,
    },
    e2e: {
      enabled: true,
      // Mock project: deterministic, no external services, no Vercel deploy.
      args: ["--project=mock"],
      // Parity with CI: blank Supabase env vars so the app falls back to
      // mock mode even though .env.local exists locally. Real env vars take
      // precedence over .env.local in Next, so "" reliably disables them.
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      },
    },
  },
};
