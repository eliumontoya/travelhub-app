import { defineConfig, devices } from "@playwright/test";

// Playwright 1.62 does not yet expose `default` on the Project type, but the
// design reserves it as the opt-in marker for non-default projects. Declare
// the field so the intent is type-safe; the corresponding `test:e2e` script
// is pinned to `--project=mock` so preview does not run by default today.
declare module "@playwright/test" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Project {
    default?: boolean;
  }
}

// `mock` project runs against the local dev server (no remote target).
// `preview` project runs against the deployed Vercel preview URL supplied
// via BASE_URL. The presence of BASE_URL also disables the top-level
// webServer so the preview job does not start a redundant local server.
const hasRemoteTarget = !!process.env.BASE_URL;
const bypassToken = process.env.VERCEL_PROTECTION_BYPASS || "";

export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "html" : "list",
  timeout: 30_000,
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mock",
      testDir: "e2e/mock",
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
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
