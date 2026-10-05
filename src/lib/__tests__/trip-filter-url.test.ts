import { describe, expect, it } from "vitest";
import {
  buildTripFilterSearchParams,
  cleanTripFilters,
  deserializeTripFilters,
  normalizeFilterText,
  TRIP_FILTER_URL_KEYS,
} from "@/lib/trip-filters";
import type { TripFilters } from "@/types";

const params = (query: string) => new URLSearchParams(query);

describe("deserializeTripFilters", () => {
  it("traduce una URL completa a TripFilters", () => {
    const filters = deserializeTripFilters(
      params(
        "q=luna&status=draft,published&dateFrom=2026-01-01&dateTo=2026-02-01&client=c1,c2&tags=t1,t2&agent=a1&currency=USD",
      ),
    );

    expect(filters).toEqual({
      query: "luna",
      status: ["draft", "published"],
      dateFrom: "2026-01-01",
      dateTo: "2026-02-01",
      clientIds: ["c1", "c2"],
      tagIds: ["t1", "t2"],
      agentIds: ["a1"],
      currency: "USD",
    });
  });

  it("devuelve un objeto vacío para una URL sin filtros", () => {
    expect(deserializeTripFilters(params(""))).toEqual({});
  });

  it("omite q y fechas en blanco, status inválido y moneda inválida", () => {
    expect(
      deserializeTripFilters(params("q=&dateFrom=&dateTo=&status=bogus&currency=BAD")),
    ).toEqual({});
  });

  it("valida status y descarta los valores no soportados", () => {
    expect(deserializeTripFilters(params("status=draft,bogus")).status).toEqual(["draft"]);
    expect(deserializeTripFilters(params("status=bogus"))).not.toHaveProperty("status");
  });

  it("divide la CSV sin recortar espacios", () => {
    expect(deserializeTripFilters(params("client=a,b")).clientIds).toEqual(["a", "b"]);
    expect(deserializeTripFilters(params("client=a,")).clientIds).toEqual(["a", ""]);
  });

  it("conserva las tres monedas soportadas", () => {
    expect(deserializeTripFilters(params("currency=MXN")).currency).toBe("MXN");
    expect(deserializeTripFilters(params("currency=USD")).currency).toBe("USD");
    expect(deserializeTripFilters(params("currency=EUR")).currency).toBe("EUR");
  });
});

describe("cleanTripFilters", () => {
  it("elimina los valores vacíos y conserva los reales", () => {
    expect(
      cleanTripFilters({
        query: "",
        status: [],
        dateFrom: undefined,
        dateTo: undefined,
        clientIds: ["c1"],
        tagIds: [],
        agentIds: [],
        currency: undefined,
      }),
    ).toEqual({ clientIds: ["c1"] });
  });

  it("conserva cada valor verdadero", () => {
    const filters: Partial<TripFilters> = {
      query: "luna",
      status: ["draft"],
      dateFrom: "2026-01-01",
      dateTo: "2026-02-01",
      clientIds: ["c1"],
      tagIds: ["t1"],
      agentIds: ["a1"],
      currency: "MXN",
    };

    expect(cleanTripFilters(filters)).toEqual(filters);
  });

  it("devuelve un objeto nuevo sin mutar la entrada", () => {
    const input: Partial<TripFilters> = { query: "", clientIds: ["c1"] };
    const result = cleanTripFilters(input);

    expect(result).not.toBe(input);
    expect(input).toEqual({ query: "", clientIds: ["c1"] });
  });
});

describe("buildTripFilterSearchParams", () => {
  it("declara la lista congelada de claves de filtro", () => {
    expect(TRIP_FILTER_URL_KEYS).toEqual([
      "q",
      "status",
      "dateFrom",
      "dateTo",
      "client",
      "tags",
      "agent",
      "currency",
      "page",
      "clientsPage",
    ]);
  });

  it("borra page y clientsPage junto con el resto de claves de filtro", () => {
    const current = params(
      "q=old&status=draft&dateFrom=2026-01-01&dateTo=2026-01-02&client=c1&tags=t1&agent=a1&currency=USD&page=3&clientsPage=2",
    );
    const result = buildTripFilterSearchParams(current, {});

    expect(result.toString()).toBe("");
  });

  it("no muta los params de entrada", () => {
    const current = params("page=3");
    const result = buildTripFilterSearchParams(current, { query: "luna" });

    expect(result).not.toBe(current);
    expect(current.toString()).toBe("page=3");
  });

  it("escribe solo los filtros no vacíos en el orden original de claves", () => {
    const result = buildTripFilterSearchParams(params("foo=bar"), {
      query: "luna",
      status: ["draft", "published"],
      dateFrom: "2026-01-01",
      dateTo: "2026-02-01",
      clientIds: ["c1", "c2"],
      tagIds: ["t1"],
      agentIds: ["a1"],
      currency: "USD",
    });

    expect([...result.keys()]).toEqual([
      "foo",
      "q",
      "status",
      "dateFrom",
      "dateTo",
      "client",
      "tags",
      "agent",
      "currency",
    ]);
    expect(result.get("q")).toBe("luna");
    expect(result.get("status")).toBe("draft,published");
    expect(result.get("dateFrom")).toBe("2026-01-01");
    expect(result.get("dateTo")).toBe("2026-02-01");
    expect(result.get("client")).toBe("c1,c2");
    expect(result.get("tags")).toBe("t1");
    expect(result.get("agent")).toBe("a1");
    expect(result.get("currency")).toBe("USD");
  });

  it("preserva los params ajenos al filtro y no emite claves vacías", () => {
    const result = buildTripFilterSearchParams(params("foo=bar&page=3"), {
      query: "",
      status: [],
      clientIds: [],
    });

    expect(result.get("foo")).toBe("bar");
    expect(result.has("q")).toBe(false);
    expect(result.has("status")).toBe(false);
    expect(result.has("client")).toBe(false);
    expect(result.has("page")).toBe(false);
  });
});

describe("normalizeFilterText", () => {
  it("pliega acentos y mayúsculas", () => {
    expect(normalizeFilterText("Cancún")).toBe("cancun");
    expect(normalizeFilterText("PÉREZ")).toBe("perez");
  });
});
