import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Contract test (migration pattern "a" — see helpers/db.ts): the Supabase
 * client is mocked and `isSupabaseConfigured()` returns true, so the real
 * Supabase branch of `src/lib/data/settings.ts` runs. We assert the exact
 * `.from()/.select()/.eq()/.upsert()` shapes and the snake_case → camelCase
 * row mapping that the data module performs.
 */
const state = vi.hoisted(() => {
  interface Call {
    table: string;
    method: string;
    args: unknown[];
  }

  const calls: Call[] = [];
  let row: Record<string, unknown> | null = null;

  function createBuilder(table: string) {
    const builder = {
      select(...args: unknown[]) {
        calls.push({ table, method: "select", args });
        return builder;
      },
      eq(...args: unknown[]) {
        calls.push({ table, method: "eq", args });
        return builder;
      },
      upsert(...args: unknown[]) {
        calls.push({ table, method: "upsert", args });
        return builder;
      },
      async maybeSingle() {
        calls.push({ table, method: "maybeSingle", args: [] });
        return { data: row, error: null };
      },
      async single() {
        calls.push({ table, method: "single", args: [] });
        const patch = calls
          .filter((call) => call.table === table && call.method === "upsert")
          .at(-1)?.args[0];
        if (patch && typeof patch === "object") {
          const next = patch as Record<string, unknown>;
          // Mirror the singleton upsert: the server returns the merged row.
          row = {
            id: 1,
            email: next.email ?? row?.email ?? "",
            phone: next.phone ?? row?.phone ?? "",
            agency_name: next.agency_name ?? row?.agency_name ?? "",
            logo_url: next.logo_url ?? row?.logo_url ?? "",
          };
        }
        return { data: row, error: null };
      },
    };
    return builder;
  }

  const client = { from: (table: string) => createBuilder(table) };

  return {
    calls,
    client,
    reset() {
      calls.length = 0;
      row = null;
    },
    setRow(next: Record<string, unknown> | null) {
      row = next;
    },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
  createClient: async () => state.client,
}));

import { getSiteSettings, updateSiteSettings } from "@/lib/data";

beforeEach(() => state.reset());

describe("site settings (Supabase contract)", () => {
  it("reads the singleton row via select('*').eq('id', 1).maybeSingle()", async () => {
    state.setRow({
      id: 1,
      email: "hola@agencia.mx",
      phone: "+52 55 0000 0000",
      agency_name: "Mi Agencia",
      logo_url: "https://example.com/logo.png",
    });

    const settings = await getSiteSettings();

    expect(settings).toEqual({
      email: "hola@agencia.mx",
      phone: "+52 55 0000 0000",
      agencyName: "Mi Agencia",
      logoUrl: "https://example.com/logo.png",
    });
    expect(state.calls).toEqual([
      { table: "site_settings", method: "select", args: ["*"] },
      { table: "site_settings", method: "eq", args: ["id", 1] },
      { table: "site_settings", method: "maybeSingle", args: [] },
    ]);
  });

  it("maps missing/null branding columns to empty-string defaults", async () => {
    state.setRow({ id: 1 });

    await expect(getSiteSettings()).resolves.toEqual({
      email: "",
      phone: "",
      agencyName: "",
      logoUrl: "",
    });
  });

  it("returns empty branding when the singleton row does not exist yet", async () => {
    state.setRow(null);

    await expect(getSiteSettings()).resolves.toEqual({
      email: "",
      phone: "",
      agencyName: "",
      logoUrl: "",
    });
  });

  it("upserts the mapped snake_case patch with id=1 and returns the persisted row", async () => {
    const settings = await updateSiteSettings({
      agencyName: "Mi Agencia",
      logoUrl: "https://example.com/logo.png",
    });

    const upsertCall = state.calls.find((call) => call.method === "upsert");
    expect(upsertCall?.args).toEqual([
      { id: 1, agency_name: "Mi Agencia", logo_url: "https://example.com/logo.png" },
    ]);
    expect(state.calls.map((call) => call.method)).toEqual(["upsert", "select", "single"]);
    expect(settings).toEqual({
      email: "",
      phone: "",
      agencyName: "Mi Agencia",
      logoUrl: "https://example.com/logo.png",
    });
  });

  it("persists explicit empty strings for cleared branding fields", async () => {
    await updateSiteSettings({ agencyName: "", logoUrl: "" });

    await expect(getSiteSettings()).resolves.toEqual({
      email: "",
      phone: "",
      agencyName: "",
      logoUrl: "",
    });
  });

  it("round-trips an update then read through the same singleton row", async () => {
    await updateSiteSettings({
      email: "hola@agencia.mx",
      phone: "+52 55 0000 0000",
      agencyName: "Mi Agencia",
      logoUrl: "https://example.com/logo.png",
    });
    state.calls.length = 0;

    await expect(getSiteSettings()).resolves.toEqual({
      email: "hola@agencia.mx",
      phone: "+52 55 0000 0000",
      agencyName: "Mi Agencia",
      logoUrl: "https://example.com/logo.png",
    });
  });
});
