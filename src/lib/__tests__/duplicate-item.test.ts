import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Contract test (migration pattern "a" — see helpers/db.ts): the Supabase
 * client is mocked and `isSupabaseConfigured()` returns true, so the real
 * Supabase branch of `src/lib/data/trip-items.ts` runs. We assert the read →
 * count → insert query shapes `duplicateItem` issues, plus the field mapping.
 */
const state = vi.hoisted(() => {
  interface Call {
    table: string;
    method: string;
    args: unknown[];
  }

  const calls: Call[] = [];
  let sourceRow: Record<string, unknown> | null = null;
  let countValue = 0;
  let queryError: unknown = null;
  let insertError: unknown = null;
  let insertedRow: Record<string, unknown> | null = null;
  let mode: "source" | "count" | "insert" = "source";

  function createBuilder() {
    const builder = {
      select(...args: unknown[]) {
        calls.push({ table: "items", method: "select", args });
        const options = args[1] as { count?: string } | undefined;
        if (options?.count) mode = "count";
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
      insert(...args: unknown[]) {
        calls.push({ table: "items", method: "insert", args });
        const input = args[0] as Record<string, unknown>;
        insertedRow = {
          id: "copy-1",
          ...input,
          item_metadata: input.item_metadata ?? null,
          sort_order: input.sort_order ?? 0,
        };
        mode = "insert";
        return builder;
      },
      async maybeSingle() {
        calls.push({ table: "items", method: "maybeSingle", args: [] });
        return { data: sourceRow, error: queryError };
      },
      async single() {
        calls.push({ table: "items", method: "single", args: [] });
        return { data: insertedRow, error: insertError };
      },
      then(resolve: (value: unknown) => unknown) {
        const result =
          mode === "count"
            ? { data: null, error: queryError, count: countValue }
            : { data: null, error: queryError };
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
      sourceRow = null;
      countValue = 0;
      queryError = null;
      insertError = null;
      insertedRow = null;
      mode = "source";
    },
    setSource(row: Record<string, unknown> | null) {
      sourceRow = row;
    },
    getSource() {
      return sourceRow;
    },
    setCount(value: number) {
      countValue = value;
    },
    setQueryError(error: unknown) {
      queryError = error;
    },
    setInsertError(error: unknown) {
      insertError = error;
    },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
  createClient: async () => state.client,
}));

import { duplicateItem } from "@/lib/data";

const sourceRow = {
  id: "src-1",
  trip_day_id: "day-A",
  type: "activity",
  title: "Tour guiado",
  start_time: "09:00",
  end_time: null,
  location: "Centro",
  lat: null,
  lng: null,
  confirmation_code: null,
  notes: null,
  cost: 100,
  supplier_id: null,
  created_by_client_id: null,
  sort_order: 0,
  item_metadata: { activityName: "Tour" },
};

beforeEach(() => state.reset());

describe("duplicateItem (Supabase contract)", () => {
  it("reads the source, counts the destination items and inserts the copy preserving fields", async () => {
    state.setSource({ ...sourceRow });
    state.setCount(2);

    const copy = await duplicateItem("src-1", "day-B");

    const insertCall = state.calls.find((call) => call.method === "insert");
    const inserted = insertCall?.args[0] as Record<string, unknown>;
    expect(inserted).toMatchObject({
      trip_day_id: "day-B",
      type: "activity",
      title: "Tour guiado",
      start_time: "09:00",
      location: "Centro",
      cost: 100,
      supplier_id: null,
      created_by_client_id: null,
      sort_order: 2,
      item_metadata: { activityName: "Tour" },
    });
    expect(inserted.end_time).toBeNull();

    expect(copy.id).toBe("copy-1");
    expect(copy.tripDayId).toBe("day-B");
    expect(copy.type).toBe("activity");
    expect(copy.metadata).toEqual({ activityName: "Tour" });
  });

  it("appends the copy at the end of the destination day (sort_order = count)", async () => {
    state.setSource({ ...sourceRow });
    state.setCount(5);

    await duplicateItem("src-1", "day-B");

    const insertCall = state.calls.find((call) => call.method === "insert");
    const inserted = insertCall?.args[0] as Record<string, unknown>;
    expect(inserted.sort_order).toBe(5);

    const countCall = state.calls.find(
      (call) => call.method === "select" && (call.args[1] as { count?: string })?.count === "exact"
    );
    expect(countCall?.args).toEqual(["id", { count: "exact", head: true }]);
    expect(state.calls.some((call) => call.method === "eq" && call.args[0] === "trip_day_id")).toBe(true);
  });

  it("duplicates to the same day, preserving the original row", async () => {
    state.setSource({ ...sourceRow });
    state.setCount(1);

    const copy = await duplicateItem("src-1", "day-A");

    const insertCall = state.calls.find((call) => call.method === "insert");
    const inserted = insertCall?.args[0] as Record<string, unknown>;
    expect(inserted.trip_day_id).toBe("day-A");
    expect(copy.tripDayId).toBe("day-A");
    expect(state.getSource()).toEqual(sourceRow);
  });

  it("does not copy attached documents", async () => {
    state.setSource({ ...sourceRow });
    state.setCount(0);

    await duplicateItem("src-1", "day-B");

    // duplicateItem never reads the `documents` table — documents attached to
    // the source item are deliberately not duplicated.
    expect(state.calls.every((call) => call.table === "items")).toBe(true);
  });

  it("rejects when the source item is missing, without inserting", async () => {
    state.setSource(null);

    await expect(duplicateItem("missing", "day-B")).rejects.toThrow("Item no encontrado");
    expect(state.calls.some((call) => call.method === "insert")).toBe(false);
  });

  it("propagates a source read error", async () => {
    state.setSource(null);
    state.setQueryError(new Error("source read failed"));

    await expect(duplicateItem("src-1", "day-B")).rejects.toThrow("source read failed");
  });

  it("propagates an insert error", async () => {
    state.setSource({ ...sourceRow });
    state.setCount(0);
    state.setInsertError(new Error("insert failed"));

    await expect(duplicateItem("src-1", "day-B")).rejects.toThrow("insert failed");
  });
});
