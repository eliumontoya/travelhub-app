import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Contract test (migration pattern "a" — see helpers/db.ts): the Supabase
 * client is mocked and `isSupabaseConfigured()` returns true, so the real
 * Supabase branch of `src/lib/data/trip-items.ts` runs. `moveItemToDay` only
 * issues queries (no read-back), so we assert the exact query shapes and the
 * computed `sort_order`.
 */
const state = vi.hoisted(() => {
  interface Call {
    table: string;
    method: string;
    args: unknown[];
  }

  const calls: Call[] = [];
  let siblings: Record<string, unknown>[] = [];
  let queryError: unknown = null;
  let updateError: unknown = null;
  let mode: "select" | "update" = "select";

  function createBuilder() {
    const builder = {
      select(...args: unknown[]) {
        calls.push({ table: "items", method: "select", args });
        mode = "select";
        return builder;
      },
      eq(...args: unknown[]) {
        calls.push({ table: "items", method: "eq", args });
        return builder;
      },
      is(...args: unknown[]) {
        calls.push({ table: "items", method: "is", args });
        return builder;
      },
      update(...args: unknown[]) {
        calls.push({ table: "items", method: "update", args });
        mode = "update";
        return builder;
      },
      then(resolve: (value: unknown) => unknown) {
        const result = mode === "update" ? { data: null, error: updateError } : { data: siblings, error: queryError };
        return Promise.resolve(result).then(resolve);
      },
    };
    return builder;
  }

  const client = { from: () => createBuilder() };

  return {
    calls,
    client,
    reset() {
      calls.length = 0;
      siblings = [];
      queryError = null;
      updateError = null;
      mode = "select";
    },
    setSiblings(rows: Record<string, unknown>[]) {
      siblings = rows;
    },
    setQueryError(error: unknown) {
      queryError = error;
    },
    setUpdateError(error: unknown) {
      updateError = error;
    },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
  createClient: async () => state.client,
}));

import { moveItemToDay } from "@/lib/data";

beforeEach(() => state.reset());

describe("moveItemToDay (Supabase contract)", () => {
  it("reassigns the item to the target day, appending after the last sibling", async () => {
    state.setSiblings([{ sort_order: 0 }, { sort_order: 4 }]);

    await moveItemToDay("item-1", "day-B");

    expect(state.calls).toEqual([
      { table: "items", method: "select", args: ["sort_order"] },
      { table: "items", method: "eq", args: ["trip_day_id", "day-B"] },
      { table: "items", method: "is", args: ["deleted_at", null] },
      { table: "items", method: "update", args: [{ trip_day_id: "day-B", sort_order: 5 }] },
      { table: "items", method: "eq", args: ["id", "item-1"] },
    ]);
  });

  it("appends at sort_order 0 when the destination day is empty", async () => {
    state.setSiblings([]);

    await moveItemToDay("item-1", "day-B");

    const updateCall = state.calls.find((call) => call.method === "update");
    expect(updateCall?.args).toEqual([{ trip_day_id: "day-B", sort_order: 0 }]);
  });

  it("only changes trip_day_id and sort_order (all other fields preserved)", async () => {
    state.setSiblings([{ sort_order: 2 }]);

    await moveItemToDay("item-1", "day-B");

    const updateCall = state.calls.find((call) => call.method === "update");
    const patch = updateCall?.args[0] as Record<string, unknown>;
    expect(Object.keys(patch).sort()).toEqual(["sort_order", "trip_day_id"]);
  });

  it("coerces a null sibling sort_order to 0 before taking the max", async () => {
    state.setSiblings([{ sort_order: null }, { sort_order: 3 }]);

    await moveItemToDay("item-1", "day-B");

    const updateCall = state.calls.find((call) => call.method === "update");
    expect(updateCall?.args).toEqual([{ trip_day_id: "day-B", sort_order: 4 }]);
  });

  it("propagates a sibling query error without issuing the move", async () => {
    state.setSiblings([]);
    state.setQueryError(new Error("siblings query failed"));

    await expect(moveItemToDay("item-1", "day-B")).rejects.toThrow("siblings query failed");
    expect(state.calls.some((call) => call.method === "update")).toBe(false);
  });

  it("propagates an update error", async () => {
    state.setSiblings([]);
    state.setUpdateError(new Error("update failed"));

    await expect(moveItemToDay("item-1", "day-B")).rejects.toThrow("update failed");
  });
});
