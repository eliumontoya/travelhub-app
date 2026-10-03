import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Contract tests (migration pattern "a" — see helpers/db.ts): the Supabase
 * client is mocked and `isSupabaseConfigured()` returns true, so the real
 * Supabase branch of `src/lib/data/services.ts` runs. We assert the exact
 * client-portal query shapes: checklist ownership, progress totals, and the
 * reviewed/processed completion filter.
 */
const state = vi.hoisted(() => {
  type Response = { data: unknown; error: unknown };
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const responses: Record<string, Response> = {};

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
      in(...args: unknown[]) {
        calls.push({ table, method: "in", args });
        return builder;
      },
      order(...args: unknown[]) {
        calls.push({ table, method: "order", args });
        return builder;
      },
      async maybeSingle() {
        calls.push({ table, method: "maybeSingle", args: [] });
        return responses[table] ?? { data: null, error: null };
      },
      then(resolve: (value: Response) => unknown) {
        return Promise.resolve(responses[table] ?? { data: null, error: null }).then(resolve);
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
      for (const key of Object.keys(responses)) delete responses[key];
    },
    respond(table: string, response: Response) {
      responses[table] = response;
    },
    callsFor(table: string, method: string) {
      return calls.filter((call) => call.table === table && call.method === method);
    },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
  createClient: async () => state.client,
  getSupabaseAdmin: () => state.client,
}));

import {
  getServicesProgressForClient,
  uploadServiceDocument,
} from "@/lib/data/services";

beforeEach(() => {
  state.reset();
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
});

describe("client portal data layer (Supabase contract)", () => {
  it("uploadServiceDocument rejects a checklist item that belongs to another service", async () => {
    state.respond("service_checklist_items", { data: null, error: null });
    const file = new File(["x"], "passport.pdf", { type: "application/pdf" });

    await expect(uploadServiceDocument("service-2", "item-1", file)).rejects.toThrow(
      "El item no pertenece al servicio"
    );

    expect(state.callsFor("service_checklist_items", "select")[0].args).toEqual(["id, service_id"]);
    expect(state.callsFor("service_checklist_items", "eq")).toEqual([
      { table: "service_checklist_items", method: "eq", args: ["id", "item-1"] },
      { table: "service_checklist_items", method: "eq", args: ["service_id", "service-2"] },
    ]);
    // Ownership is checked before any storage or upload write.
    expect(state.callsFor("service_uploads", "upsert")).toHaveLength(0);
  });

  it("getServicesProgressForClient returns {completed,total} keyed by service", async () => {
    state.respond("services", { data: [{ id: "service-1" }], error: null });
    state.respond("service_checklist_items", {
      data: [{ service_id: "service-1" }, { service_id: "service-1" }],
      error: null,
    });
    state.respond("service_uploads", { data: [], error: null });

    const progress = await getServicesProgressForClient("c1");

    expect(progress.get("service-1")).toEqual({ completed: 0, total: 2 });
    expect(state.callsFor("services", "eq")).toEqual([
      { table: "services", method: "eq", args: ["client_id", "c1"] },
      { table: "services", method: "eq", args: ["service_type", "trip_documents"] },
    ]);
    expect(state.callsFor("service_checklist_items", "in")).toContainEqual(
      expect.objectContaining({ args: ["service_id", ["service-1"]] })
    );
  });

  it("progress counts reviewed and processed uploads as completed", async () => {
    state.respond("services", { data: [{ id: "service-1" }], error: null });
    state.respond("service_checklist_items", {
      data: [
        { service_id: "service-1" },
        { service_id: "service-1" },
        { service_id: "service-1" },
      ],
      error: null,
    });
    // The real query filters status in (reviewed, processed); a
    // `re_upload_requested` upload is excluded from the completed count.
    state.respond("service_uploads", { data: [{ service_id: "service-1" }], error: null });

    const progress = await getServicesProgressForClient("c1");

    expect(progress.get("service-1")).toEqual({ completed: 1, total: 3 });
    expect(state.callsFor("service_uploads", "in")).toContainEqual(
      expect.objectContaining({ args: ["status", ["reviewed", "processed"]] })
    );
  });
});
