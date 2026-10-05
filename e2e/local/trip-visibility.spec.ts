import { expect, test } from "@playwright/test";
import { SEED, ensureTripStatus, loginAsAgent, signInClient } from "./helpers";

/**
 * Core use case (issue #396): a traveler must not see a draft trip, and once
 * the agent publishes it the same traveler must see it. Uses the seeded draft
 * "Aventura en Cancún" (`cancun-gomez-2026`, client c2 Familia Gómez).
 *
 * Tests run in file order (serial project, workers=1) and leave the seeded
 * trip back in `draft` so later runs start from the seed state.
 *
 * Note: c2 has no seeded PIN, so the signed-in-traveler assertion uses c1
 * (Ana Pérez): `trip-visibility.ts` gates drafts on the preview token alone —
 * no client session may reveal a draft.
 *
 * Note: the public route answers a hidden trip with HTTP 200 and the shared
 * "Itinerario no disponible" UI (Next.js streams the not-found boundary), so
 * visibility is asserted on the rendered UI, not on the status code.
 */

const DRAFT_SLUG = "cancun-gomez-2026";
const NOT_FOUND_HEADING = "Itinerario no disponible";

async function expectHidden(page: import("@playwright/test").Page): Promise<void> {
  await page.goto(`/t/${DRAFT_SLUG}`);
  await expect(page.getByRole("heading", { name: NOT_FOUND_HEADING })).toBeVisible();
  await expect(page.getByRole("heading", { name: SEED.draftTripTitle })).toHaveCount(0);
}

test("hides a draft trip from anonymous visitors and from a signed-in traveler", async ({
  page,
}) => {
  await loginAsAgent(page);
  await ensureTripStatus(page, SEED.draftTripId, "draft");

  await page.context().clearCookies();
  await expectHidden(page);

  await signInClient(page);
  await expectHidden(page);
});

// Preview-token draft access is broken end to end: RLS hides draft rows from
// the anon client used by /t/[slug], so the editor's "Vista previa borrador"
// link renders the not-found UI even for the agent. See issue #404.
test.fixme("exposes the draft through the agent preview link only", async ({ page }) => {
  await loginAsAgent(page);
  await page.goto(`/dashboard/trips/${SEED.draftTripId}`);

  const previewLink = page.getByRole("link", { name: "Vista previa borrador" });
  await expect(previewLink).toBeVisible();
  const previewHref = await previewLink.getAttribute("href");
  expect(previewHref).toBe(`/t/${DRAFT_SLUG}?preview=${encodeURIComponent(SEED.draftTripId)}`);

  await page.goto(previewHref!);
  await expect(page.getByRole("heading", { name: SEED.draftTripTitle })).toBeVisible();
});

test("publishing the trip makes it visible to anonymous visitors and travelers", async ({
  page,
}) => {
  await loginAsAgent(page);
  await ensureTripStatus(page, SEED.draftTripId, "published");

  await page.context().clearCookies();
  await page.goto(`/t/${DRAFT_SLUG}`);
  await expect(page.getByRole("heading", { name: SEED.draftTripTitle })).toBeVisible();

  await signInClient(page);
  await page.goto(`/t/${DRAFT_SLUG}`);
  await expect(page.getByRole("heading", { name: SEED.draftTripTitle })).toBeVisible();
});

test("reverting to draft hides the trip again", async ({ page }) => {
  await loginAsAgent(page);
  await ensureTripStatus(page, SEED.draftTripId, "draft");

  await page.context().clearCookies();
  await expectHidden(page);
});
