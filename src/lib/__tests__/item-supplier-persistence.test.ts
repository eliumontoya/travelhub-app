import { beforeEach, describe, expect, it, vi } from "vitest";

type SupplierRow = {
  id: string;
  name: string;
  type: string;
  deleted_at?: string | null;
};

type ItemRow = {
  id: string;
  trip_day_id: string;
  type: string;
  title: string;
  supplier_id: string | null;
  sort_order: number;
  item_metadata: null;
};

const mocks = vi.hoisted(() => ({
  suppliers: new Map<string, SupplierRow>(),
  item: null as ItemRow | null,
  insertCalls: [] as Record<string, unknown>[],
  updateCalls: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
  createClient: async () => ({
    from(table: string) {
      if (table === "suppliers") {
        return {
          select: () => ({
            eq: (_column: string, id: string) => ({
              maybeSingle: async () => ({ data: mocks.suppliers.get(id) ?? null, error: null }),
            }),
          }),
        };
      }

      return {
        select: () => ({
          eq: () => ({
            is: () => ({
              maybeSingle: async () => ({ data: mocks.item, error: null }),
            }),
          }),
        }),
        insert: (input: Record<string, unknown>) => {
          mocks.insertCalls.push(input);
          return {
            select: () => ({
              single: async () => ({
                data: {
                  id: "server-created",
                  ...input,
                  item_metadata: input.item_metadata ?? null,
                  sort_order: input.sort_order ?? 0,
                },
                error: null,
              }),
            }),
          };
        },
        update: (patch: Record<string, unknown>) => {
          mocks.updateCalls.push(patch);
          return {
            eq: () => ({
              select: () => ({
                single: async () => ({
                  data: { ...mocks.item, ...patch },
                  error: null,
                }),
              }),
            }),
          };
        },
      };
    },
  }),
}));

import { createItem, updateItem } from "@/lib/data/trips";

const hotelSupplierId = "s1";
const restaurantSupplierId = "s2";

function serverItem(overrides: Partial<ItemRow> = {}): ItemRow {
  return {
    id: "server-item",
    trip_day_id: "d1",
    type: "hotel",
    title: "Server hotel",
    supplier_id: hotelSupplierId,
    sort_order: 0,
    item_metadata: null,
    ...overrides,
  };
}

describe("item supplier persistence", () => {
  beforeEach(() => {
    mocks.suppliers = new Map([
      [hotelSupplierId, { id: hotelSupplierId, name: "Hotel", type: "hotel" }],
      [restaurantSupplierId, { id: restaurantSupplierId, name: "Restaurant", type: "restaurant" }],
    ]);
    mocks.item = serverItem();
    mocks.insertCalls = [];
    mocks.updateCalls = [];
  });

  it("persists compatible and supplier-free creates", async () => {
    await expect(createItem({ tripDayId: "d1", type: "hotel", title: "Hotel", supplierId: hotelSupplierId }))
      .resolves.toMatchObject({ type: "hotel", supplierId: hotelSupplierId });
    await expect(createItem({ tripDayId: "d1", type: "flight", title: "Flight" }))
      .resolves.toMatchObject({ type: "flight", supplierId: undefined });
  });

  it.each([
    ["missing supplier", "hotel", "missing"],
    ["mismatched supplier", "restaurant", hotelSupplierId],
    ["supplier on a flight", "flight", hotelSupplierId],
  ])("rejects a create with a %s before mutation", async (_label, type, supplierId) => {
    await expect(createItem({ tripDayId: "d1", type: type as "hotel", title: "Invalid", supplierId }))
      .rejects.toMatchObject({ code: "ITEM_SUPPLIER_INCOMPATIBLE" });
    expect(mocks.insertCalls).toEqual([]);
  });

  it("rejects a soft-deleted supplier before mutation", async () => {
    mocks.suppliers.get(hotelSupplierId)!.deleted_at = "2026-01-01T00:00:00.000Z";

    await expect(createItem({ tripDayId: "d1", type: "hotel", title: "Invalid", supplierId: hotelSupplierId }))
      .rejects.toMatchObject({ code: "ITEM_SUPPLIER_INCOMPATIBLE" });
    expect(mocks.insertCalls).toEqual([]);
  });

  it("validates the resulting state and distinguishes null from undefined", async () => {
    const created = await createItem({
      tripDayId: "d1",
      type: "hotel",
      title: "Hotel",
      supplierId: hotelSupplierId,
    });

    await expect(updateItem(created.id, { title: "Renamed" })).resolves.toMatchObject({
      title: "Renamed",
      supplierId: hotelSupplierId,
    });
    await expect(updateItem(created.id, { type: "restaurant" })).rejects.toMatchObject({
      code: "ITEM_SUPPLIER_INCOMPATIBLE",
    });
    expect(created).toMatchObject({ type: "hotel", supplierId: hotelSupplierId });
    await expect(updateItem(created.id, { supplierId: null })).resolves.toMatchObject({ supplierId: undefined });
  });

  it("enforces the compatibility contract before any insert or update mutation", async () => {
    await expect(createItem({ tripDayId: "d1", type: "restaurant", title: "Invalid", supplierId: hotelSupplierId }))
      .rejects.toMatchObject({ code: "ITEM_SUPPLIER_INCOMPATIBLE" });
    expect(mocks.insertCalls).toEqual([]);

    await expect(updateItem("server-item", { type: "restaurant" })).rejects.toMatchObject({
      code: "ITEM_SUPPLIER_INCOMPATIBLE",
    });
    expect(mocks.updateCalls).toEqual([]);

    await expect(createItem({ tripDayId: "d1", type: "restaurant", title: "Restaurant", supplierId: restaurantSupplierId }))
      .resolves.toMatchObject({ type: "restaurant", supplierId: restaurantSupplierId });
    await expect(updateItem("server-item", { supplierId: null })).resolves.toMatchObject({ supplierId: undefined });
    expect(mocks.updateCalls).toEqual([expect.objectContaining({ supplier_id: null })]);
  });
});
