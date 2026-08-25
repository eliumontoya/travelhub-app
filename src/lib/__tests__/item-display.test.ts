import { describe, expect, it } from "vitest";
import { formatItemDetailRows } from "@/lib/item-display";
import type { Item } from "@/types";

describe("formatItemDetailRows", () => {
  it("returns all visible structured flight details in traveler-friendly order", () => {
    const item: Item = {
      id: "item-1",
      tripDayId: "day-1",
      type: "flight",
      title: "Vuelo",
      sortOrder: 0,
      metadata: {
        airline: "Aeroméxico",
        flightNumber: "AM 123",
        departureAirport: "MEX",
        arrivalAirport: "MAD",
        departureTime: "10:00",
        arrivalTime: "05:00",
        terminal: "2",
        gate: "",
        seat: "12A",
      },
    };

    expect(formatItemDetailRows(item)).toEqual([
      { label: "Aerolínea", value: "Aeroméxico" },
      { label: "Vuelo", value: "AM 123" },
      { label: "Salida", value: "MEX" },
      { label: "Llegada", value: "MAD" },
      { label: "Hora de salida", value: "10:00" },
      { label: "Hora de llegada", value: "05:00" },
      { label: "Terminal", value: "2" },
      { label: "Asiento", value: "12A" },
    ]);
  });
});
