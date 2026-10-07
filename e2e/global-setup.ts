import { request } from "@playwright/test";

import { SEED } from "./local/helpers";

// The `local` project targets the local server started by the `webServer`
// block in `playwright.config.ts` (dev server locally, production server in
// CI).
const WARMUP_BASE_URL = "http://localhost:3000";
const WARMUP_TIMEOUT_MS = 15_000;

/**
 * Pre-warm the routes the suite hits first. For the dev server (local runs)
 * this moves on-demand compilation ahead of the first test's 30s budget
 * (issue #406); for the production server (CI, issue #409) it absorbs
 * first-request JIT/edge warmup. The `webServer` block already validated
 * that its own `url` responds, so a warmup failure must never abort the
 * suite: each request is best-effort and a real server problem surfaces in
 * the tests themselves.
 */
export default async function globalSetup(): Promise<void> {
  // In preview mode `BASE_URL` is set and `playwright.config.ts` disables the
  // local `webServer`; there is nothing local to warm up.
  if (process.env.BASE_URL) {
    return;
  }

  const context = await request.newContext({
    baseURL: WARMUP_BASE_URL,
    timeout: WARMUP_TIMEOUT_MS,
  });

  // `/login` and `/dashboard` are the first authenticated/navigated routes and
  // `/t/<slug>` is the seeded traveler public route. Reusing `SEED.tripSlug`
  // keeps the warmup route in lockstep with `supabase/seed.sql`.
  const routes = ["/login", "/dashboard", `/t/${SEED.tripSlug}`];

  try {
    for (const route of routes) {
      try {
        await context.get(route);
      } catch {
        // Benign by design: never fail the suite because of a warmup request.
      }
    }
  } finally {
    await context.dispose();
  }
}
