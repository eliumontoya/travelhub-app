import { describe, it, expect } from "vitest";
import { buildIcsForItem, buildIcsForTrip } from "@/lib/ics";
import { Client, Item, TripWithDetails } from "@/types";

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "item-1",
    tripDayId: "day-1",
    type: "activity",
    title: "Tour Coliseo",
    startTime: "10:00",
    endTime: "12:00",
    location: "Roma, Italia",
    confirmationCode: "CONF-123",
    notes: "Llevar calzado cómodo",
    sortOrder: 0,
    metadata: null,
    ...overrides,
  } as Item;
}

function makeTrip(): TripWithDetails {
  return {
    id: "t1",
    clientId: "c1",
    title: "Luna de miel en Italia",
    slug: "italia-perez-2026",
    startDate: "2026-09-10",
    endDate: "2026-09-11",
    travelerCount: 2,
    status: "published",
    currency: "EUR",
    isTemplate: false,
    showCostsToClient: true,
    createdAt: "2026-07-01T09:00:00Z",
    updatedAt: "2026-07-01T09:00:00Z",
    clients: [],
    client: {} as unknown as Client,
    tags: [],
    statusHistory: [],
    photos: [],
    packingItems: [],
    days: [
      {
        id: "day-1",
        tripId: "t1",
        date: "2026-09-10",
        sortOrder: 0,
        items: [
          makeItem({ id: "item-1", title: "Llegada a Roma", startTime: "14:00", type: "flight" }),
          makeItem({ id: "item-2", title: "Check-in Hotel", startTime: "16:00", type: "hotel" }),
        ],
      },
      {
        id: "day-2",
        tripId: "t1",
        date: "2026-09-11",
        sortOrder: 1,
        items: [
          makeItem({ id: "item-3", title: "Tour Coliseo", startTime: "10:00", endTime: "12:00" }),
        ],
      },
    ],
  };
}

describe("buildIcsForItem", () => {
  it("genera un ICS válido con BEGIN/END VCALENDAR", () => {
    const ics = buildIcsForItem(makeItem(), "2026-09-10");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("incluye DTSTART y DTEND correctos", () => {
    const ics = buildIcsForItem(makeItem({ startTime: "10:00", endTime: "12:00" }), "2026-09-10");
    expect(ics).toContain("DTSTART:20260910T100000");
    expect(ics).toContain("DTEND:20260910T120000");
  });

  it("usa hora por defecto 09:00 cuando no hay startTime", () => {
    const ics = buildIcsForItem(makeItem({ startTime: undefined }), "2026-09-10");
    expect(ics).toContain("DTSTART:20260910T090000");
  });

  it("suma 1 hora para endTime cuando no hay endTime explícito", () => {
    const ics = buildIcsForItem(makeItem({ startTime: "15:30", endTime: undefined }), "2026-09-10");
    expect(ics).toContain("DTEND:20260910T163000");
  });

  it("incluye SUMMARY con el título del item", () => {
    const ics = buildIcsForItem(makeItem({ title: "Tour del Coliseo" }), "2026-09-10");
    expect(ics).toContain("SUMMARY:Tour del Coliseo");
  });

  it("incluye LOCATION cuando existe", () => {
    const ics = buildIcsForItem(makeItem({ location: "Roma, Italia" }), "2026-09-10");
    expect(ics).toContain("LOCATION:Roma\\, Italia");
  });

  it("escapa caracteres especiales en texto", () => {
    const ics = buildIcsForItem(makeItem({ title: "Reunión; conferencia" }), "2026-09-10");
    expect(ics).toContain("SUMMARY:Reunión\\; conferencia");
  });

  it("incluye DESCRIPTION con confirmación y notas", () => {
    const ics = buildIcsForItem(
      makeItem({ confirmationCode: "CONF-123", notes: "Llevar calzado" }),
      "2026-09-10"
    );
    expect(ics).toContain("DESCRIPTION:Confirmación: CONF-123 - Llevar calzado");
  });

  it("UID contiene el id del item", () => {
    const ics = buildIcsForItem(makeItem({ id: "item-42" }), "2026-09-10");
    expect(ics).toContain("UID:item-42@travelhub");
  });
});

describe("buildIcsForTrip", () => {
  it("genera un ICS con todos los items de todos los días", () => {
    const trip = makeTrip();
    const ics = buildIcsForTrip(trip);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("Llegada a Roma");
    expect(ics).toContain("Check-in Hotel");
    expect(ics).toContain("Tour Coliseo");
  });

  it("genera eventos con las fechas correctas por día", () => {
    const trip = makeTrip();
    const ics = buildIcsForTrip(trip);
    expect(ics).toContain("DTSTART:20260910T140000");
    expect(ics).toContain("DTSTART:20260911T100000");
  });
});
