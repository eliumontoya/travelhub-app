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
    coverage: {
      enabled: true,
      // Baseline ratchet (calibrated 2026-10-03 to current levels):
      // CI fails only if coverage drops below these; raise as it improves.
      minLines: 50,
      minBranches: 40,
      minFunctions: 50,
      minStatements: 48,
    },
  },
};
