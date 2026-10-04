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
    // Riesgo aceptado y documentado (travelhub-app#395): braces <=3.0.3
    // (GHSA-vfj7-8cjw-p6xm) no tiene parche publicado; la cadena afectada
    // (micromatch, fast-glob, @next/eslint-plugin-next, eslint-config-next)
    // es dev-only, se ejecuta solo en lint con patrones de la config, nunca
    // en runtime. La aceptación transitiva cubre los 4 paquetes derivados.
    auditAllow: [
      {
        package: "braces",
        reason:
          "dev-only lint chain, no upstream fix available (documented risk travelhub-app#395)",
      },
    ],
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
      // Seeded-state e2e: fresh local database before every run.
      args: ["--project=local"],
      pre: "npm run db:reset",
    },
  },
};
