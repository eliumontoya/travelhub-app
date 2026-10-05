import { expect, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Shared fixtures for the `local` Playwright project.
 *
 * Every value here maps to the deterministic seed loaded by
 * `supabase db reset` (see `supabase/seed.sql`). The local project runs with
 * the real Supabase path (no mock mode), so auth goes through the real
 * Supabase login form and the client portal uses the seeded PIN.
 */
export const SEED = {
  admin: { email: "admin@travelhub.test", password: "password123" },
  agent: { email: "agent@travelhub.test", password: "password123" },
  client: { email: "ana.perez@example.com", pin: "123456", name: "Ana y Roberto Pérez" },
  secondClient: { email: "gomez.family@example.com", pin: "123456", name: "Familia Gómez" },
  clientId: "c1000000-0000-4000-8000-000000000001",
  secondClientId: "c2000000-0000-4000-8000-000000000002",
  tripId: "11111111-1111-4111-8111-111111111111",
  draftTripId: "22222222-2222-4222-8222-222222222222",
  tripSlug: "italia-perez-2026",
  tripTitle: "Luna de miel en Italia",
  draftTripTitle: "Aventura en Cancún",
  firstDayId: "d1000000-0000-4000-8000-000000000001",
  serviceId: "5c100000-0000-4000-8000-000000000001",
  supplierTourOperatorId: "5a900000-0000-4000-8000-000000000009",
  clientHistorySlug: "ana-y-roberto-perez",
} as const;

export const LOCAL_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
export const LOCAL_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
// Service-role key needed for the REST cleanup helpers below: row mutations
// bypass RLS only with the service role. Same value the `webServer` env in
// `playwright.config.ts` injects for the local stack.
export const LOCAL_SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

/**
 * REST options for the service role. The REST client always returns the
 * affected rows so callers can report how many rows they cleaned up.
 */
const SERVICE_ROLE_HEADERS = {
  apikey: LOCAL_SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${LOCAL_SUPABASE_SERVICE_ROLE_KEY}`,
};

/** Short, human-readable suffix that is unique per Playwright run. */
export function uniqueSuffix(): string {
  return Date.now().toString(36);
}

/**
 * Append a per-run suffix to a readable base name. Specs that create
 * persistent entities use this so a repeated run (or a retry) never collides
 * with a residual row from an earlier attempt (issue #406).
 */
export function uniqueName(base: string): string {
  return `${base} ${uniqueSuffix()}`;
}

type RowFilters = Record<string, string>;

async function deleteRows(
  request: APIRequestContext,
  table: string,
  filters: RowFilters,
): Promise<number> {
  const response = await request.delete(`${LOCAL_SUPABASE_URL}/rest/v1/${table}`, {
    params: filters,
    headers: { ...SERVICE_ROLE_HEADERS, Prefer: "return=representation" },
  });
  expect(response.ok()).toBeTruthy();
  const rows = (await response.json()) as unknown[];
  return rows.length;
}

/**
 * Delete every row in `table` matching an exact column value. Returns the
 * number of deleted rows.
 */
export async function deleteRowsByEq(
  request: APIRequestContext,
  table: string,
  column: string,
  value: string,
  extraFilters: RowFilters = {},
): Promise<number> {
  return deleteRows(request, table, { ...extraFilters, [column]: `eq.${value}` });
}

/**
 * Delete every row in `table` whose `column` matches a LIKE pattern (`*` is
 * the PostgREST wildcard). Useful to remove residuals that share a readable
 * prefix owned by a spec. Returns the number of deleted rows.
 */
export async function deleteRowsByNameLike(
  request: APIRequestContext,
  table: string,
  column: string,
  pattern: string,
  extraFilters: RowFilters = {},
): Promise<number> {
  return deleteRows(request, table, { ...extraFilters, [column]: `like.${pattern}` });
}

/**
 * Patch every row in `table` matching an exact column value with a JSON body.
 * Returns the number of updated rows.
 */
export async function patchRowsByEq(
  request: APIRequestContext,
  table: string,
  column: string,
  value: string,
  body: Record<string, unknown>,
): Promise<number> {
  const response = await request.patch(`${LOCAL_SUPABASE_URL}/rest/v1/${table}`, {
    params: { [column]: `eq.${value}` },
    data: body,
    headers: { ...SERVICE_ROLE_HEADERS, Prefer: "return=representation" },
  });
  expect(response.ok()).toBeTruthy();
  const rows = (await response.json()) as unknown[];
  return rows.length;
}

/** Sign in an operator (admin/agent) through the real `/login` form. */
export async function loginAs(
  page: Page,
  email: string,
  password: string = SEED.admin.password,
): Promise<void> {
  await page.goto("/login");
  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=password]").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.waitForURL(/\/dashboard/);
}

export async function loginAsAdmin(page: Page): Promise<void> {
  await loginAs(page, SEED.admin.email, SEED.admin.password);
}

export async function loginAsAgent(page: Page): Promise<void> {
  await loginAs(page, SEED.agent.email, SEED.agent.password);
}

/** Sign in a client through the real `/client/login` form (seeded PIN). */
export async function signInClient(
  page: Page,
  email: string = SEED.client.email,
  pin: string = SEED.client.pin,
): Promise<void> {
  await page.goto("/client/login");
  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=pin]").fill(pin);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/client");
}

export async function logoutClient(page: Page): Promise<void> {
  await page.goto("/client");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/status=loggedOut/);
  await expect(page.getByText("Sesión cerrada correctamente.")).toBeVisible();
}

/**
 * Set the client portal PIN from the agent dashboard. Requires an operator
 * session (admin/agent with the `clients` feature).
 */
export async function setClientPin(
  page: Page,
  clientId: string,
  pin: string = SEED.client.pin,
): Promise<void> {
  await page.goto(`/dashboard/clients/${clientId}`);
  await page.getByText("PIN de acceso para el cliente").click();
  await page.locator("input[name=pin]").fill(pin);
  await page.locator("input[name=confirmPin]").fill(pin);
  await page.getByRole("button", { name: "Guardar PIN" }).click();
  await expect(page.getByText("PIN actualizado correctamente.")).toBeVisible();
}

/**
 * Idempotently drive the seeded trip to the requested status. Requires an
 * operator session. The publish toggle on the editor is the real flow; the
 * status badge tells us the current state so an archived trip is not mistaken
 * for a draft (both show the "Publicar" toggle).
 */
export async function ensureTripStatus(
  page: Page,
  tripId: string,
  status: "draft" | "published",
): Promise<void> {
  await page.goto(`/dashboard/trips/${tripId}`);
  const badge = page.locator("h1").locator("xpath=following-sibling::span[1]");
  const current = (await badge.textContent())?.trim();

  if (status === "published") {
    if (current !== "Publicado") {
      await page.getByRole("button", { name: "Publicar", exact: true }).click();
    }
  } else if (current === "Publicado") {
    await page.getByRole("button", { name: "Pasar a borrador", exact: true }).click();
  } else if (current === "Archivado") {
    // Archived trips only toggle back to published; get there, then to draft.
    await page.getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(badge).toHaveText("Publicado");
    await page.getByRole("button", { name: "Pasar a borrador", exact: true }).click();
  }

  await expect(badge).toHaveText(status === "published" ? "Publicado" : "Borrador");
}

/**
 * Resolve a supplier id by its seeded name via the local REST API. Migration
 * 0029 seeds s1..s5 with `gen_random_uuid()` (non-deterministic), so specs must
 * look their UUIDs up instead of hardcoding them.
 */
export async function findSupplierIdByName(
  request: APIRequestContext,
  name: string,
): Promise<string> {
  const response = await request.get(`${LOCAL_SUPABASE_URL}/rest/v1/suppliers`, {
    params: { name: `eq.${name}`, select: "id" },
    headers: {
      apikey: LOCAL_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${LOCAL_SUPABASE_ANON_KEY}`,
    },
  });
  expect(response.ok()).toBeTruthy();
  const rows = (await response.json()) as Array<{ id: string }>;
  expect(rows.length).toBeGreaterThan(0);
  return rows[0].id;
}
