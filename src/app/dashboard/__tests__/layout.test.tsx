import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUserRole } = vi.hoisted(() => ({
  getCurrentUserRole: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: vi.fn(() => undefined) })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  isSupabaseConfigured: vi.fn(() => false),
}));
vi.mock("@/lib/auth/roles", () => ({ getCurrentUserRole }));
vi.mock("@/lib/data", () => ({
  ALL_CLIENTS_PAGE_SIZE: 100,
  ALL_TRIPS_PAGE_SIZE: 100,
  getClients: vi.fn(async () => ({ items: [] })),
  getTripsWithClients: vi.fn(async () => ({ items: [] })),
}));
vi.mock("@/lib/changelog", () => ({ getChangelog: vi.fn(() => []) }));
vi.mock("@/components/ProfileMenu", () => ({ ProfileMenu: () => <div /> }));
vi.mock("@/components/ChangelogDialog", () => ({ ChangelogDialog: () => <div /> }));
vi.mock("@/components/CommandPalette", () => ({ CommandPalette: () => <div /> }));
vi.mock("@/components/ThemeToggle", () => ({ ThemeToggle: () => <div /> }));
vi.mock("@/app/dashboard/settings/actions", () => ({ signOutAction: vi.fn() }));

import DashboardLayout from "../layout";

async function renderLayout(role: "admin" | "agent") {
  getCurrentUserRole.mockResolvedValue(role);
  return renderToStaticMarkup(await DashboardLayout({ children: <p>Content</p> }));
}

describe("DashboardLayout navigation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the admin-only Cuentas link without dropping redesigned navigation entries", async () => {
    const html = await renderLayout("admin");

    expect(html).toContain('href="/dashboard/settings/accounts"');
    expect(html).toContain(">Cuentas<");
    for (const label of ["Dashboard", "Viajes", "Clientes", "Proveedores", "Agentes", "WhatsApp C.C.", "Ajustes"]) {
      expect(html).toContain(`>${label}<`);
    }
  });

  it("does not expose Cuentas to agents", async () => {
    const html = await renderLayout("agent");

    expect(html).not.toContain('href="/dashboard/settings/accounts"');
    expect(html).not.toContain(">Cuentas<");
  });
});
