import { describe, expect, it, vi } from "vitest";
import {
  getClientActiveTrips,
  getClientByWhatsappPhone,
  getTripDocumentsStatus,
  getTripPaymentStatus,
  getTripSummary,
  runTravelHubClientTool,
  type TravelHubToolSupabaseClient,
} from "@/lib/ai/tools/travelhub-client-tools";

type TableHandler = (query: MockQuery) => void;

class MockQuery {
  operations: Array<{ name: string; args: unknown[] }> = [];
  result: unknown = { data: null, error: null };

  constructor(private readonly table: string, private readonly handler?: TableHandler) {
    this.handler?.(this);
  }

  select(...args: unknown[]) { this.operations.push({ name: "select", args }); return this; }
  eq(...args: unknown[]) { this.operations.push({ name: "eq", args }); return this; }
  neq(...args: unknown[]) { this.operations.push({ name: "neq", args }); return this; }
  in(...args: unknown[]) { this.operations.push({ name: "in", args }); return this; }
  or(...args: unknown[]) { this.operations.push({ name: "or", args }); return this; }
  order(...args: unknown[]) { this.operations.push({ name: "order", args }); return this; }
  limit(...args: unknown[]) { this.operations.push({ name: "limit", args }); return this; }
  upsert(...args: unknown[]) { this.operations.push({ name: "upsert", args }); return this; }
  insert(...args: unknown[]) { this.operations.push({ name: "insert", args }); return this; }
  maybeSingle = vi.fn(async () => this.result);
  single = vi.fn(async () => this.result);
  then(resolve: (value: unknown) => unknown) { return Promise.resolve(this.result).then(resolve); }
}

function makeClient(handlers: Record<string, TableHandler | TableHandler[]>) {
  const queries: Record<string, MockQuery[]> = {};
  const from = vi.fn((table: string) => {
    const list = handlers[table];
    const index = queries[table]?.length ?? 0;
    const handler = Array.isArray(list) ? list[index] : list;
    const query = new MockQuery(table, handler);
    queries[table] = [...(queries[table] ?? []), query];
    return query;
  });
  return { client: { from } as unknown as TravelHubToolSupabaseClient, queries, from };
}

describe("controlled TravelHub client tools", () => {
  it("resolves clients.whatsapp before consulting manual WhatsApp contact links", async () => {
    const mock = makeClient({
      clients: (query) => {
        query.result = { data: [{ id: "client-crm-1", name: "Jane CRM", whatsapp: "+52 1 555 123 4567" }], error: null };
      },
      crm_sync_events: (query) => { query.result = { data: { id: "audit-1" }, error: null }; },
    });

    const result = await getClientByWhatsappPhone({ phone: "5215551234567" }, mock.client);

    expect(result.status).toBe("success");
    expect(result.data).toMatchObject({ found: true, clientId: "client-crm-1", displayName: "Jane CRM", matchConfidence: "exact" });
    expect(mock.queries.clients[0].operations).toContainEqual({ name: "eq", args: ["whatsapp_normalized", "5215551234567"] });
    expect(mock.queries.clients[0].operations).toContainEqual({ name: "limit", args: [2] });
    expect(mock.from).not.toHaveBeenCalledWith("whatsapp_contacts");
  });

  it("marks duplicate clients.whatsapp matches as ambiguous before fallback lookup", async () => {
    const mock = makeClient({
      clients: (query) => {
        query.result = {
          data: [
            { id: "client-1", name: "Jane One", whatsapp: "5215551234567" },
            { id: "client-2", name: "Jane Two", whatsapp: "+52 1 555 123 4567" },
          ],
          error: null,
        };
      },
      crm_sync_events: (query) => { query.result = { data: { id: "audit-1" }, error: null }; },
    });

    const result = await getClientByWhatsappPhone({ phone: "+52 1 555 123 4567" }, mock.client);

    expect(result.status).toBe("ambiguous");
    expect(result.data).toMatchObject({ found: false, matchConfidence: "possible" });
    expect(mock.from).not.toHaveBeenCalledWith("whatsapp_contacts");
  });

  it("falls back to a linked WhatsApp contact when clients.whatsapp has no match", async () => {
    const mock = makeClient({
      clients: (query) => {
        query.result = { data: [], error: null };
      },
      whatsapp_contacts: (query) => {
        query.result = { data: { linked_client_id: "client-1", display_name: "Jane", clients: { name: "Jane Traveler" } }, error: null };
      },
      crm_sync_events: (query) => { query.result = { data: { id: "audit-1" }, error: null }; },
    });

    const result = await getClientByWhatsappPhone({ phone: "+52 1 555 123 4567" }, mock.client);

    expect(result.status).toBe("success");
    expect(result.data).toMatchObject({ found: true, clientId: "client-1", displayName: "Jane Traveler", matchConfidence: "exact" });
    expect(mock.queries.whatsapp_contacts[0].operations).toContainEqual({ name: "eq", args: ["phone_e164", "5215551234567"] });
  });

  it("marks active trip lookup as ambiguous when a client has multiple active trips", async () => {
    const mock = makeClient({
      trip_clients: (query) => {
        query.result = { data: [
          { trip_id: "trip-1", trips: { id: "trip-1", title: "Cancún", slug: "cancun", start_date: "2026-09-01", end_date: "2026-09-05", status: "published" } },
          { trip_id: "trip-2", trips: { id: "trip-2", title: "Madrid", slug: "madrid", start_date: "2026-10-01", end_date: "2026-10-08", status: "draft" } },
        ], error: null };
      },
      trips: (query) => { query.result = { data: [], error: null }; },
      crm_sync_events: (query) => { query.result = { data: { id: "audit-1" }, error: null }; },
    });

    const result = await getClientActiveTrips({ clientId: "client-1" }, mock.client);

    expect(result.status).toBe("ambiguous");
    expect(result.data?.trips).toHaveLength(2);
    expect(result.data?.trips[0]).toEqual(expect.not.objectContaining({ clientId: expect.anything() }));
  });

  it("returns a safe summary for an owned trip", async () => {
    const mock = makeClient({
      trip_clients: (query) => { query.result = { data: { trip_id: "trip-1" }, error: null }; },
      trips: (query) => { query.result = { data: { id: "trip-1", title: "Cancún familiar", slug: "cancun", start_date: "2026-09-01", end_date: "2026-09-05", status: "published", traveler_count: 4, currency: "MXN", show_costs_to_client: false }, error: null }; },
      crm_sync_events: (query) => { query.result = { data: { id: "audit-1" }, error: null }; },
    });

    const result = await getTripSummary({ clientId: "client-1", tripId: "trip-1" }, mock.client);

    expect(result.status).toBe("success");
    expect(result.data).toMatchObject({ tripId: "trip-1", title: "Cancún familiar", status: "published", travelerCount: 4 });
    expect(result.data).toEqual(expect.not.objectContaining({ salePrice: expect.anything(), commissionRate: expect.anything() }));
  });

  it("blocks trip summary when the trip does not belong to the resolved client", async () => {
    const mock = makeClient({
      trip_clients: (query) => { query.result = { data: null, error: null }; },
      trips: (query) => { query.result = { data: null, error: null }; },
      crm_sync_events: (query) => { query.result = { data: { id: "audit-1" }, error: null }; },
    });

    const result = await getTripSummary({ clientId: "client-1", tripId: "other-trip" }, mock.client);

    expect(result.status).toBe("blocked");
    expect(result.reason).toMatch(/does not belong/i);
    expect(mock.queries.trips).toHaveLength(1);
  });

  it("requires a human for payment status until payment policy and schema exist", async () => {
    const mock = makeClient({
      trip_clients: (query) => { query.result = { data: { trip_id: "trip-1" }, error: null }; },
      crm_sync_events: (query) => { query.result = { data: { id: "audit-1" }, error: null }; },
    });

    const result = await getTripPaymentStatus({ clientId: "client-1", tripId: "trip-1" }, mock.client);

    expect(result.status).toBe("needs_human");
    expect(result.data).toMatchObject({ policy: "payment_status_requires_human" });
    expect(mock.from).not.toHaveBeenCalledWith("payments");
  });

  it("summarizes document availability without returning private paths or URLs", async () => {
    const mock = makeClient({
      trip_clients: (query) => { query.result = { data: { trip_id: "trip-1" }, error: null }; },
      trip_documents: (query) => { query.result = { data: [{ id: "doc-1", file_path: "secret/path.pdf", filename: "Voucher.pdf" }], error: null }; },
      trip_days: (query) => { query.result = { data: [{ items: [{ documents: [{ id: "item-doc-1", file_url: "secret/item.pdf" }] }] }], error: null }; },
      crm_sync_events: (query) => { query.result = { data: { id: "audit-1" }, error: null }; },
    });

    const result = await getTripDocumentsStatus({ clientId: "client-1", tripId: "trip-1" }, mock.client);

    expect(result.status).toBe("success");
    expect(result.data).toMatchObject({ tripDocumentCount: 1, itemDocumentCount: 1, hasDocuments: true });
    expect(JSON.stringify(result)).not.toContain("secret/path.pdf");
    expect(JSON.stringify(result)).not.toContain("secret/item.pdf");
  });

  it("blocks unsupported router tool names before domain table reads", async () => {
    const mock = makeClient({});

    const result = await runTravelHubClientTool({ tool: "deleteTrip", arguments: { tripId: "trip-1" } }, mock.client);

    expect(result.status).toBe("blocked");
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("returns data even when audit insertion fails non-fatally", async () => {
    const mock = makeClient({
      whatsapp_contacts: (query) => { query.result = { data: { linked_client_id: "client-1", display_name: "Jane", clients: { name: "Jane" } }, error: null }; },
      crm_sync_events: (query) => { query.result = { data: null, error: { message: "duplicate audit" } }; },
    });

    const result = await getClientByWhatsappPhone({ phone: "5215551234567" }, mock.client);

    expect(result.status).toBe("success");
    expect(result.audit).toMatchObject({ attempted: true, ok: false });
    expect(result.audit?.error).not.toContain("service-role");
  });
});
