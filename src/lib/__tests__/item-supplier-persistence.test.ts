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
  configured: false,
  suppliers: new Map<string, SupplierRow>(),
  item: null as ItemRow | null,
  insertCalls: [] as Record<string, unknown>[],
  updateCalls: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => mocks.configured,
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

import { mockItems, mockSuppliers } from "@/lib/mock-data";
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
    mocks.configured = false;
    mocks.suppliers = new Map([
      [hotelSupplierId, { id: hotelSupplierId, name: "Hotel", type: "hotel" }],
      [restaurantSupplierId, { id: restaurantSupplierId, name: "Restaurant", type: "restaurant" }],
    ]);
    mocks.item = serverItem();
    mocks.insertCalls = [];
    mocks.updateCalls = [];
    delete mockSuppliers.find((supplier) => supplier.id === hotelSupplierId)?.deletedAt;
  });

  it("persists compatible and supplier-free mock creates", async () => {
    await expect(createItem({ tripDayId: "d1", type: "hotel", title: "Hotel", supplierId: hotelSupplierId }))
      .resolves.toMatchObject({ type: "hotel", supplierId: hotelSupplierId });
    await expect(createItem({ tripDayId: "d1", type: "flight", title: "Flight" }))
      .resolves.toMatchObject({ type: "flight", supplierId: undefined });
  });

  it.each([
    ["missing supplier", "hotel", "missing"],
    ["mismatched supplier", "restaurant", hotelSupplierId],
    ["supplier on a flight", "flight", hotelSupplierId],
  ])("rejects a mock create with a %s before mutation", async (_label, type, supplierId) => {
    const itemCount = mockItems.length;
    await expect(createItem({ tripDayId: "d1", type: type as "hotel", title: "Invalid", supplierId }))
      .rejects.toMatchObject({ code: "ITEM_SUPPLIER_INCOMPATIBLE" });
    expect(mockItems).toHaveLength(itemCount);
  });

  it("rejects a soft-deleted mock supplier before mutation", async () => {
    const supplier = mockSuppliers.find((candidate) => candidate.id === hotelSupplierId)!;
    supplier.deletedAt = "2026-01-01T00:00:00.000Z";
    const itemCount = mockItems.length;

    await expect(createItem({ tripDayId: "d1", type: "hotel", title: "Invalid", supplierId: hotelSupplierId }))
      .rejects.toMatchObject({ code: "ITEM_SUPPLIER_INCOMPATIBLE" });
    expect(mockItems).toHaveLength(itemCount);
  });

  it("validates the resulting mock state and distinguishes null from undefined", async () => {
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

  it("uses the same pre-mutation compatibility contract in the Supabase branch", async () => {
    mocks.configured = true;

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
