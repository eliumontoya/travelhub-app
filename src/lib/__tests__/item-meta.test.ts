import { describe, it, expect } from "vitest";
import {
  itemTypeMeta,
  currencyMeta,
  formatAssignedClients,
  formatCost,
  computeTripCompleteness,
  formatRelativeTime,
} from "@/lib/item-meta";
import { Client, Item, ItemType, TripDay, TripWithDetails } from "@/types";

describe("itemTypeMeta", () => {
  it("tiene metadata para todos los tipos de item", () => {
    const types: ItemType[] = ["flight", "hotel", "activity", "restaurant", "transport", "note"];
    for (const type of types) {
      expect(itemTypeMeta[type]).toBeDefined();
      expect(itemTypeMeta[type].label).toBeTruthy();
      expect(itemTypeMeta[type].icon).toBeTruthy();
      expect(itemTypeMeta[type].color).toBeTruthy();
    }
  });
});

describe("currencyMeta", () => {
  it("tiene metadata para MXN, USD y EUR", () => {
    expect(currencyMeta.MXN).toBeDefined();
    expect(currencyMeta.USD).toBeDefined();
    expect(currencyMeta.EUR).toBeDefined();
  });
});

describe("formatAssignedClients", () => {
  const makeClient = (name: string): Client => ({
    id: "1",
    name,
    email: "",
    phone: "",
    createdAt: "",
    updatedAt: "",
  });

  it("retorna string vacío para array vacío", () => {
    expect(formatAssignedClients([])).toBe("");
  });

  it("muestra un solo nombre", () => {
    expect(formatAssignedClients([makeClient("Ana")])).toBe("Ana");
  });

  it("muestra dos nombres separados por coma", () => {
    expect(formatAssignedClients([makeClient("Ana"), makeClient("Luis")])).toBe("Ana, Luis");
  });

  it("muestra primeros 2 + '+N más' para 3 o más clientes", () => {
    const clients = [
      makeClient("Ana"),
      makeClient("Luis"),
      makeClient("Carla"),
      makeClient("Diego"),
    ];
    expect(formatAssignedClients(clients)).toBe("Ana, Luis +2 más");
  });
});

describe("formatCost", () => {
  it("formatea MXN por defecto", () => {
    const result = formatCost(1500);
    expect(result).toContain("1");
    expect(result).toContain("500");
  });

  it("formatea USD", () => {
    const result = formatCost(100, "USD");
    expect(result).toContain("100");
  });

  it("formatea EUR", () => {
    const result = formatCost(250, "EUR");
    expect(result).toContain("250");
  });
});

describe("computeTripCompleteness", () => {
  const makeTrip = (days: TripWithDetails["days"]): TripWithDetails =>
    ({
      days,
    }) as TripWithDetails;

  it("retorna 100% cuando no hay items", () => {
    const result = computeTripCompleteness(makeTrip([{ items: [] } as unknown as TripDay & { items: Item[] }]));
    expect(result.documentPercentage).toBe(100);
    expect(result.totalItems).toBe(0);
  });

  it("calcula porcentaje correctamente", () => {
    const result = computeTripCompleteness(
      makeTrip([
        {
          items: [
            { documents: [{}] } as unknown as Item,
            { documents: [{}] } as unknown as Item,
            { documents: [] } as unknown as Item,
          ],
        } as unknown as TripDay & { items: Item[] },
      ])
    );
    expect(result.totalItems).toBe(3);
    expect(result.itemsWithDocuments).toBe(2);
    expect(result.documentPercentage).toBe(67);
  });

  it("identifica días vacíos", () => {
    const result = computeTripCompleteness(
      makeTrip([
        { id: "d1", date: "2026-09-10", items: [] } as unknown as TripDay & { items: Item[] },
        { id: "d2", date: "2026-09-11", items: [{ documents: [] } as unknown as Item] } as unknown as TripDay & { items: Item[] },
        { id: "d3", date: "2026-09-12", items: [] } as unknown as TripDay & { items: Item[] },
      ])
    );
    expect(result.emptyDays).toHaveLength(2);
    expect(result.emptyDays[0].id).toBe("d1");
    expect(result.emptyDays[1].id).toBe("d3");
  });
});

describe("formatRelativeTime", () => {
  it("retorna 'justo ahora' para timestamps recientes", () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe("justo ahora");
  });
});
