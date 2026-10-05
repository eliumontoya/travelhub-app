import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Contract tests (migration pattern "a" — see helpers/db.ts): the Supabase
 * client is mocked and `isSupabaseConfigured()` returns true, so the real
 * Supabase branch of `src/lib/data/trip-items.ts` runs.
 *
 * The traveler-activity mutations are Postgres `security definer` RPCs, so the
 * module's job here is to normalize the input, call the RPC with the exact
 * named parameters, and map an RPC error to `{ ok: false, reason: "unauthorized" }`.
 * The RPC's own authorization/ownership semantics cannot be proven by a mocked
 * client — those are asserted as call shapes here and deferred to phase-3 e2e
 * coverage against the real database.
 */
const state = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  type Call = { name: string; args: unknown };

  const tables = new Map<string, Row[]>();
  const calls: Call[] = [];
  let rpcImpl: (name: string, args: Record<string, unknown>) => { data: unknown; error: unknown } =
    () => ({ data: null, error: null });

  const table = (name: string): Row[] => {
    let rows = tables.get(name);
    if (!rows) {
      rows = [];
      tables.set(name, rows);
    }
    return rows;
  };

  function createBuilder(tableName: string) {
    const filters: [string, unknown][] = [];
    const builder = {
      select(...args: unknown[]) {
        calls.push({ name: `${tableName}.select`, args });
        return builder;
      },
      eq(...args: unknown[]) {
        calls.push({ name: `${tableName}.eq`, args });
        filters.push([args[0] as string, args[1]]);
        return builder;
      },
      in(...args: unknown[]) {
        calls.push({ name: `${tableName}.in`, args });
        return builder;
      },
      is(...args: unknown[]) {
        calls.push({ name: `${tableName}.is`, args });
        return builder;
      },
      order(...args: unknown[]) {
        calls.push({ name: `${tableName}.order`, args });
        return builder;
      },
      limit(...args: unknown[]) {
        calls.push({ name: `${tableName}.limit`, args });
        return builder;
      },
      async maybeSingle() {
        calls.push({ name: `${tableName}.maybeSingle`, args: [] });
        const row = table(tableName).find((candidate) =>
          filters.every(([col, value]) => candidate[col] === value)
        );
        return { data: row ?? null, error: null };
      },
      then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
        return Promise.resolve({ data: [], error: null }).then(resolve);
      },
    };
    return builder;
  }

  const client = {
    from: (name: string) => createBuilder(name),
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name: `rpc:${name}`, args });
      return rpcImpl(name, args);
    },
  };

  return {
    calls,
    client,
    table,
    reset() {
      tables.clear();
      calls.length = 0;
      rpcImpl = () => ({ data: null, error: null });
    },
    setRpc(next: typeof rpcImpl) {
      rpcImpl = next;
    },
    callsFor(name: string) {
      return calls.filter((call) => call.name === name);
    },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
  createClient: async () => state.client,
  getSupabaseAdmin: () => state.client,
}));

vi.mock("@/lib/auth/roles", () => ({ requireRole: vi.fn() }));

import {
  canClientAddActivities,
  createTravelerActivity,
  deleteTravelerActivity,
  rowToItem,
  updateTravelerActivity,
} from "@/lib/data";
import { requireRole } from "@/lib/auth/roles";
import { editItemAction } from "@/app/dashboard/trips/[id]/actions";

function seedTrip(overrides: Record<string, unknown> = {}) {
  state.table("trips").push({
    id: "t1",
    status: "published",
    slug: "t1",
    title: "Trip",
    ...overrides,
  });
}

function seedAssignment(tripId: string, clientId: string) {
  state.table("trip_clients").push({ trip_id: tripId, client_id: clientId });
}

function travelerInput(
  overrides: Partial<{
    tripId: string;
    tripDayId: string;
    clientId: string;
    title: string;
    startTime: string;
    location: string;
    notes: string;
  }> = {}
) {
  return {
    tripId: "t1",
    tripDayId: "d1",
    clientId: "c1",
    title: "Traveler museum visit",
    ...overrides,
  };
}

function rpcItemRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    trip_day_id: "d1",
    type: "activity",
    title: "Traveler museum visit",
    start_time: null,
    end_time: null,
    location: null,
    confirmation_code: null,
    notes: null,
    cost: null,
    supplier_id: null,
    created_by_client_id: "c1",
    sort_order: 0,
    item_metadata: null,
    ...overrides,
  };
}

beforeEach(() => {
  state.reset();
  vi.mocked(requireRole).mockResolvedValue("agent");
});

describe("traveler activity data operations (Supabase contract)", () => {
  it("calls create_traveler_activity with sanitized fields and maps the returned row", async () => {
    let received: Record<string, unknown> = {};
    state.setRpc((name, args) => {
      received = args;
      return {
        data: rpcItemRow({
          title: args.p_title,
          start_time: args.p_start_time,
          location: args.p_location,
          notes: args.p_notes,
          created_by_client_id: args.p_client_id,
        }),
        error: null,
      };
    });

    const result = await createTravelerActivity(
      travelerInput({
        startTime: "09:30",
        location: "Museum",
        notes: "<strong>Meet at entrance</strong><script>alert(1)</script>",
      })
    );

    expect(result).toMatchObject({
      ok: true,
      item: {
        type: "activity",
        createdByClientId: "c1",
        title: "Traveler museum visit",
        startTime: "09:30",
        location: "Museum",
      },
    });
    if (result.ok) expect(result.item.notes).not.toContain("<script");

    expect(state.callsFor("rpc:create_traveler_activity")[0].args).toEqual({
      p_trip_id: "t1",
      p_trip_day_id: "d1",
      p_client_id: "c1",
      p_title: "Traveler museum visit",
      p_start_time: "09:30",
      p_location: "Museum",
      p_notes: expect.stringContaining("Meet at entrance"),
    });
    expect(received.p_notes).not.toContain("<script");
  });

  it("rejects overlong fields and invalid time before calling the RPC", async () => {
    await expect(
      createTravelerActivity(travelerInput({ title: "x".repeat(121) }))
    ).resolves.toEqual({ ok: false, reason: "invalid" });
    await expect(
      createTravelerActivity(travelerInput({ startTime: "25:00" }))
    ).resolves.toEqual({ ok: false, reason: "invalid" });

    expect(state.callsFor("rpc:create_traveler_activity")).toHaveLength(0);
  });

  it("canClientAddActivities requires a published trip and an assigned client", async () => {
    seedTrip({ id: "t1", status: "published" });
    seedAssignment("t1", "c1");

    await expect(canClientAddActivities("t1", "c1")).resolves.toBe(true);
    await expect(canClientAddActivities("t1", "c2")).resolves.toBe(false);

    expect(state.callsFor("trips.eq")).toEqual([
      { name: "trips.eq", args: ["id", "t1"] },
      { name: "trips.eq", args: ["status", "published"] },
      { name: "trips.eq", args: ["id", "t1"] },
      { name: "trips.eq", args: ["status", "published"] },
    ]);
    expect(state.callsFor("trip_clients.eq")).toContainEqual(
      expect.objectContaining({ args: ["client_id", "c2"] })
    );

    state.table("trips")[0].status = "draft";
    await expect(canClientAddActivities("t1", "c1")).resolves.toBe(false);
  });

  it("maps an RPC rejection to the shared unauthorized result for missing/wrong scope", async () => {
    state.setRpc(() => ({ data: null, error: { message: "forbidden" } }));

    await expect(createTravelerActivity(travelerInput({ clientId: "c2" }))).resolves.toEqual({
      ok: false,
      reason: "unauthorized",
    });
    await expect(createTravelerActivity(travelerInput({ tripId: "t2" }))).resolves.toEqual({
      ok: false,
      reason: "unauthorized",
    });
    await expect(
      createTravelerActivity(travelerInput({ tripDayId: "d2", tripId: "t2" }))
    ).resolves.toEqual({ ok: false, reason: "unauthorized" });
  });

  it("keeps the last successful activity intact when a later create is rejected", async () => {
    // The DB (security definer RPC) is the authority for lifecycle gating; a
    // mocked client can only prove the module returns the successful row and
    // does not mutate it on a later rejection.
    state.setRpc((_name, args) => ({
      data: rpcItemRow({
        id: "item-archived",
        title: args.p_title,
        start_time: args.p_start_time,
        location: args.p_location,
        notes: args.p_notes,
        created_by_client_id: args.p_client_id,
      }),
      error: null,
    }));
    const created = await createTravelerActivity(
      travelerInput({
        title: "Archived lifecycle museum visit",
        startTime: "11:45",
        location: "Capitoline Museums",
        notes: "Keep visible in stored itinerary data",
      })
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    state.setRpc(() => ({ data: null, error: { message: "trip not published" } }));
    await expect(createTravelerActivity(travelerInput({ title: "Blocked after archive" }))).resolves.toEqual(
      { ok: false, reason: "unauthorized" }
    );

    expect(created.item).toMatchObject({
      id: "item-archived",
      title: "Archived lifecycle museum visit",
      startTime: "11:45",
      location: "Capitoline Museums",
      notes: "Keep visible in stored itinerary data",
      createdByClientId: "c1",
    });
  });

  it("calls update_traveler_activity and soft_delete_traveler_activity for owner actions", async () => {
    state.setRpc((name, args) => {
      if (name === "update_traveler_activity") {
        return { data: rpcItemRow({ id: args.p_item_id, title: args.p_title }), error: null };
      }
      if (name === "soft_delete_traveler_activity") {
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });

    await expect(
      updateTravelerActivity({ ...travelerInput(), itemId: "item-1", title: "Updated title" })
    ).resolves.toMatchObject({ ok: true, item: { title: "Updated title" } });
    expect(state.callsFor("rpc:update_traveler_activity")[0].args).toMatchObject({
      p_trip_id: "t1",
      p_trip_day_id: "d1",
      p_client_id: "c1",
      p_item_id: "item-1",
      p_title: "Updated title",
    });

    await expect(
      deleteTravelerActivity({ tripId: "t1", tripDayId: "d1", clientId: "c1", itemId: "item-1" })
    ).resolves.toEqual({ ok: true });
    expect(state.callsFor("rpc:soft_delete_traveler_activity")[0].args).toMatchObject({
      p_trip_id: "t1",
      p_trip_day_id: "d1",
      p_client_id: "c1",
      p_item_id: "item-1",
    });
  });

  it("maps cross-client and null-owner RPC rejections to unauthorized", async () => {
    // The RPC owns the cross-client / null-owner authorization check (a mocked
    // client cannot prove non-mutation); the module must not leak a distinct
    // reason and must surface unauthorized.
    state.setRpc(() => ({ data: null, error: { message: "not the owner" } }));

    await expect(
      updateTravelerActivity({ ...travelerInput(), itemId: "traveler-owned", title: "Tampered" })
    ).resolves.toEqual({ ok: false, reason: "unauthorized" });
    await expect(
      deleteTravelerActivity({
        tripId: "t1",
        tripDayId: "d1",
        clientId: "c1",
        itemId: "agent-item",
      })
    ).resolves.toEqual({ ok: false, reason: "unauthorized" });
  });

  it("maps absent creator attribution as null for legacy and agent rows", () => {
    expect(
      rowToItem({
        id: "legacy-item",
        trip_day_id: "d1",
        type: "activity",
        title: "Legacy activity",
        sort_order: 0,
        item_metadata: null,
        created_by_client_id: null,
      }).createdByClientId
    ).toBeNull();
  });

  it("preserves the agent published-trip lock before any item write", async () => {
    seedTrip({ id: "t1", status: "published", slug: "t1" });

    const formData = new FormData();
    formData.set("type", "activity");
    formData.set("title", "Agent change");
    formData.set("metadata", "null");

    await expect(editItemAction("t1", "i3", formData)).rejects.toThrow(
      "viaje publicado está bloqueado"
    );
    expect(state.callsFor("items.select")).toHaveLength(0);
  });
});
