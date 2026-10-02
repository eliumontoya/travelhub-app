import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: vi.fn(),
  createClient: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

import { isSupabaseConfigured } from "@/lib/supabase/server";
import {
  mockClients,
  mockVisaClients,
  mockVisas,
  mockVisaStatusHistory,
} from "@/lib/mock-data";

function resetVisaMocks() {
  mockVisas.length = 0;
  mockVisaClients.length = 0;
  mockVisaStatusHistory.length = 0;
}

beforeEach(() => {
  resetVisaMocks();
  vi.mocked(isSupabaseConfigured).mockReturnValue(false);
  vi.clearAllMocks();
});

// We need at least one mock client so clientIds references resolve in tests
// that hydrate VisaWithDetails via getVisaById.
function ensureMockClient(clientId: string, name = "Test Client") {
  if (!mockClients.find((c) => c.id === clientId)) {
    mockClients.push({
      id: clientId,
      name,
      slug: clientId,
      email: `${clientId}@example.com`,
      phone: "+52 55 0000 0000",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  }
}

describe("visa data layer — createVisa (mock mode)", () => {
  it("rejects missing country", async () => {
    const { createVisa } = await import("@/lib/data/visas");
    await expect(
      createVisa({ country: "", visaType: "Tourist", deadline: "2026-12-01", price: 100 })
    ).rejects.toThrow(/country/i);
  });

  it("rejects missing visaType", async () => {
    const { createVisa } = await import("@/lib/data/visas");
    await expect(
      createVisa({ country: "France", visaType: "", deadline: "2026-12-01", price: 100 })
    ).rejects.toThrow(/visaType|visa type/i);
  });

  it("rejects missing deadline", async () => {
    const { createVisa } = await import("@/lib/data/visas");
    await expect(
      createVisa({ country: "France", visaType: "Tourist", deadline: "", price: 100 })
    ).rejects.toThrow(/deadline/i);
  });

  it("rejects missing price", async () => {
    const { createVisa } = await import("@/lib/data/visas");
    await expect(
      createVisa({
        country: "France",
        visaType: "Tourist",
        deadline: "2026-12-01",
        price: undefined as unknown as number,
      })
    ).rejects.toThrow(/price/i);
  });

  it("creates a visa with status pending when given valid input", async () => {
    const { createVisa } = await import("@/lib/data/visas");
    const visa = await createVisa({
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 150,
      notes: "Honeymoon",
    });

    expect(visa.status).toBe("pending");
    expect(visa.country).toBe("France");
    expect(visa.visaType).toBe("Tourist");
    expect(visa.deadline).toBe("2026-12-01");
    expect(visa.price).toBe(150);
    expect(visa.notes).toBe("Honeymoon");
    expect(visa.id).toMatch(/[0-9a-f-]{36}/);
    expect(visa.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(visa.updatedAt).toBe(visa.createdAt);
    expect(mockVisas).toHaveLength(1);
    expect(mockVisas[0]).toEqual(visa);
  });

  it("appends an initial status history entry from null to pending", async () => {
    const { createVisa } = await import("@/lib/data/visas");
    const visa = await createVisa({
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 150,
    });

    expect(mockVisaStatusHistory).toHaveLength(1);
    const entry = mockVisaStatusHistory[0];
    expect(entry.visaId).toBe(visa.id);
    expect(entry.fromStatus).toBeNull();
    expect(entry.toStatus).toBe("pending");
    expect(entry.changedAt).toBe(visa.createdAt);
  });

  it("stores clientIds when provided", async () => {
    ensureMockClient("c1", "Ana");
    ensureMockClient("c2", "Roberto");
    const { createVisa } = await import("@/lib/data/visas");
    const visa = await createVisa({
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 150,
      clientIds: ["c1", "c2"],
    });

    expect(mockVisaClients).toHaveLength(2);
    const assigned = mockVisaClients
      .filter((vc) => vc.visaId === visa.id)
      .map((vc) => vc.clientId)
      .sort();
    expect(assigned).toEqual(["c1", "c2"]);
    // First client becomes the compatibility mirror
    expect(visa.clientId).toBe("c1");
  });

  it("accepts an empty clientIds list and leaves the mirror empty", async () => {
    const { createVisa } = await import("@/lib/data/visas");
    const visa = await createVisa({
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 150,
      clientIds: [],
    });

    expect(mockVisaClients.filter((vc) => vc.visaId === visa.id)).toHaveLength(0);
    expect(visa.clientId).toBe("");
  });
});

describe("visa data layer — read operations (mock mode)", () => {
  it("getVisaById returns the visa with clients and status history populated", async () => {
    ensureMockClient("c1", "Ana");
    mockVisas.push({
      id: "v1",
      clientId: "c1",
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 150,
      status: "pending",
      createdAt: "2026-09-30T10:00:00Z",
      updatedAt: "2026-09-30T10:00:00Z",
    });
    mockVisaClients.push({ visaId: "v1", clientId: "c1", createdAt: "2026-09-30T10:00:00Z" });
    mockVisaStatusHistory.push({
      id: "vsh1",
      visaId: "v1",
      fromStatus: null,
      toStatus: "pending",
      changedAt: "2026-09-30T10:00:00Z",
    });

    const { getVisaById } = await import("@/lib/data/visas");
    const visa = await getVisaById("v1");

    expect(visa).not.toBeNull();
    expect(visa!.id).toBe("v1");
    expect(visa!.country).toBe("France");
    expect(visa!.clients).toHaveLength(1);
    expect(visa!.clients[0].id).toBe("c1");
    expect(visa!.client.id).toBe("c1");
    expect(visa!.statusHistory).toHaveLength(1);
    expect(visa!.statusHistory[0].toStatus).toBe("pending");
    expect(visa!.documents).toEqual([]);
  });

  it("getVisaById returns null for a non-existent id", async () => {
    const { getVisaById } = await import("@/lib/data/visas");
    await expect(getVisaById("missing-id")).resolves.toBeNull();
  });

  it("getVisasWithClients returns a paginated list with clients arrays", async () => {
    ensureMockClient("c1", "Ana");
    ensureMockClient("c2", "Roberto");
    mockVisas.push(
      {
        id: "v1",
        clientId: "c1",
        country: "France",
        visaType: "Tourist",
        deadline: "2026-12-01",
        price: 150,
        status: "pending",
        createdAt: "2026-09-30T10:00:00Z",
        updatedAt: "2026-09-30T10:00:00Z",
      },
      {
        id: "v2",
        clientId: "c2",
        country: "Japan",
        visaType: "Business",
        deadline: "2026-11-15",
        price: 200,
        status: "in_progress",
        createdAt: "2026-09-29T10:00:00Z",
        updatedAt: "2026-09-29T10:00:00Z",
      }
    );
    mockVisaClients.push(
      { visaId: "v1", clientId: "c1", createdAt: "2026-09-30T10:00:00Z" },
      { visaId: "v2", clientId: "c2", createdAt: "2026-09-29T10:00:00Z" }
    );

    const { getVisasWithClients } = await import("@/lib/data/visas");
    const page1 = await getVisasWithClients({ page: 1, pageSize: 1 });

    expect(page1.totalCount).toBe(2);
    expect(page1.items).toHaveLength(1);
    expect(page1.items[0].id).toBe("v1");
    expect(page1.items[0].clients.map((c) => c.id)).toEqual(["c1"]);

    const page2 = await getVisasWithClients({ page: 2, pageSize: 1 });
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0].id).toBe("v2");
    expect(page2.items[0].clients.map((c) => c.id)).toEqual(["c2"]);
  });

  it("getVisasWithClients applies status and clientIds filters", async () => {
    ensureMockClient("c1", "Ana");
    ensureMockClient("c2", "Roberto");
    mockVisas.push(
      {
        id: "v1",
        clientId: "c1",
        country: "France",
        visaType: "Tourist",
        deadline: "2026-12-01",
        price: 150,
        status: "pending",
        createdAt: "2026-09-30T10:00:00Z",
        updatedAt: "2026-09-30T10:00:00Z",
      },
      {
        id: "v2",
        clientId: "c2",
        country: "Japan",
        visaType: "Business",
        deadline: "2026-11-15",
        price: 200,
        status: "in_progress",
        createdAt: "2026-09-29T10:00:00Z",
        updatedAt: "2026-09-29T10:00:00Z",
      }
    );
    mockVisaClients.push(
      { visaId: "v1", clientId: "c1", createdAt: "2026-09-30T10:00:00Z" },
      { visaId: "v2", clientId: "c2", createdAt: "2026-09-29T10:00:00Z" }
    );

    const { getVisasWithClients } = await import("@/lib/data/visas");
    const byStatus = await getVisasWithClients({ filters: { status: ["pending"] } });
    expect(byStatus.items.map((v) => v.id)).toEqual(["v1"]);

    const byClient = await getVisasWithClients({ filters: { clientIds: ["c2"] } });
    expect(byClient.items.map((v) => v.id)).toEqual(["v2"]);
  });

  it("getVisasByClientId returns only visas assigned to that client", async () => {
    ensureMockClient("c1", "Ana");
    ensureMockClient("c2", "Roberto");
    mockVisas.push(
      {
        id: "v1",
        clientId: "c1",
        country: "France",
        visaType: "Tourist",
        deadline: "2026-12-01",
        price: 150,
        status: "pending",
        createdAt: "2026-09-30T10:00:00Z",
        updatedAt: "2026-09-30T10:00:00Z",
      },
      {
        id: "v2",
        clientId: "c2",
        country: "Japan",
        visaType: "Business",
        deadline: "2026-11-15",
        price: 200,
        status: "in_progress",
        createdAt: "2026-09-29T10:00:00Z",
        updatedAt: "2026-09-29T10:00:00Z",
      }
    );
    mockVisaClients.push(
      { visaId: "v1", clientId: "c1", createdAt: "2026-09-30T10:00:00Z" },
      { visaId: "v2", clientId: "c2", createdAt: "2026-09-29T10:00:00Z" }
    );

    const { getVisasByClientId } = await import("@/lib/data/visas");
    const forC1 = await getVisasByClientId("c1");
    expect(forC1.map((v) => v.id)).toEqual(["v1"]);

    const forUnknown = await getVisasByClientId("unknown-client");
    expect(forUnknown).toEqual([]);
  });
});

describe("visa data layer — updateVisa (mock mode)", () => {
  beforeEach(() => {
    mockVisas.push({
      id: "v1",
      clientId: "c1",
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 150,
      notes: "Honeymoon",
      status: "pending",
      createdAt: "2026-09-30T10:00:00Z",
      updatedAt: "2026-09-30T10:00:00Z",
    });
  });

  it("updates mutable fields and bumps updatedAt", async () => {
    const { updateVisa } = await import("@/lib/data/visas");
    const updated = await updateVisa("v1", {
      country: "Spain",
      visaType: "Work",
      deadline: "2027-01-15",
      price: 250,
      notes: "Updated notes",
    });

    expect(updated.country).toBe("Spain");
    expect(updated.visaType).toBe("Work");
    expect(updated.deadline).toBe("2027-01-15");
    expect(updated.price).toBe(250);
    expect(updated.notes).toBe("Updated notes");
    expect(updated.updatedAt).not.toBe("2026-09-30T10:00:00Z");
    expect(updated.status).toBe("pending");
  });

  it("does not allow status changes through updateVisa (compile-time + runtime)", async () => {
    const { updateVisa } = await import("@/lib/data/visas");
    // The UpdateVisaInput type intentionally omits `status` so a status change
    // through updateVisa must come via transitionVisaStatus. Runtime: status
    // remains unchanged regardless of input.
    const updated = await updateVisa("v1", { country: "Italy" });
    expect(updated.status).toBe("pending");
    expect(mockVisas[0].status).toBe("pending");
  });

  it("leaves assigned clients untouched after a field edit", async () => {
    ensureMockClient("c1", "Ana");
    ensureMockClient("c2", "Roberto");
    mockVisaClients.push(
      { visaId: "v1", clientId: "c1", createdAt: "2026-09-30T10:00:00Z" },
      { visaId: "v1", clientId: "c2", createdAt: "2026-09-30T10:01:00Z" }
    );

    const { updateVisa } = await import("@/lib/data/visas");
    await updateVisa("v1", { price: 999 });

    const assigned = mockVisaClients
      .filter((vc) => vc.visaId === "v1")
      .map((vc) => vc.clientId)
      .sort();
    expect(assigned).toEqual(["c1", "c2"]);
  });
});

describe("visa data layer — setVisaClients (mock mode)", () => {
  beforeEach(() => {
    ensureMockClient("c1", "Ana");
    ensureMockClient("c2", "Roberto");
    ensureMockClient("c3", "Sofia");
    mockVisas.push({
      id: "v1",
      clientId: "c1",
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 150,
      status: "pending",
      createdAt: "2026-09-30T10:00:00Z",
      updatedAt: "2026-09-30T10:00:00Z",
    });
    mockVisaClients.push({ visaId: "v1", clientId: "c1", createdAt: "2026-09-30T10:00:00Z" });
  });

  it("assigning a new client yields the union without touching retained rows", async () => {
    const { setVisaClients } = await import("@/lib/data/visas");
    const beforeCreated = mockVisaClients.find(
      (vc) => vc.visaId === "v1" && vc.clientId === "c1"
    )!.createdAt;

    await setVisaClients("v1", ["c1", "c2"]);

    const assigned = mockVisaClients
      .filter((vc) => vc.visaId === "v1")
      .map((vc) => vc.clientId)
      .sort();
    expect(assigned).toEqual(["c1", "c2"]);
    const afterCreated = mockVisaClients.find(
      (vc) => vc.visaId === "v1" && vc.clientId === "c1"
    )!.createdAt;
    expect(afterCreated).toBe(beforeCreated);
    expect(mockVisas[0].clientId).toBe("c1");
  });

  it("re-assigning the same client set is idempotent", async () => {
    const { setVisaClients } = await import("@/lib/data/visas");
    await setVisaClients("v1", ["c1"]);
    await setVisaClients("v1", ["c1"]);

    const assigned = mockVisaClients.filter((vc) => vc.visaId === "v1");
    expect(assigned).toHaveLength(1);
    expect(assigned[0].clientId).toBe("c1");
  });

  it("assigning multiple clients at once creates one row per client", async () => {
    const { setVisaClients } = await import("@/lib/data/visas");
    await setVisaClients("v1", ["c2", "c3"]);

    const assigned = mockVisaClients
      .filter((vc) => vc.visaId === "v1")
      .map((vc) => vc.clientId)
      .sort();
    expect(assigned).toEqual(["c2", "c3"]);
    // Mirror follows the first assigned client.
    expect(mockVisas[0].clientId).toBe("c2");
  });

  it("unassigning one client removes only that client and leaves the rest", async () => {
    mockVisaClients.push({ visaId: "v1", clientId: "c2", createdAt: "2026-09-30T10:01:00Z" });
    const { setVisaClients } = await import("@/lib/data/visas");
    await setVisaClients("v1", ["c1"]);

    const assigned = mockVisaClients
      .filter((vc) => vc.visaId === "v1")
      .map((vc) => vc.clientId);
    expect(assigned).toEqual(["c1"]);
    expect(mockVisas[0].clientId).toBe("c1");
  });

  it("unassigning a non-assigned client is a no-op", async () => {
    const { setVisaClients } = await import("@/lib/data/visas");
    await setVisaClients("v1", ["c1", "c2", "c3"]);

    const assigned = mockVisaClients
      .filter((vc) => vc.visaId === "v1")
      .map((vc) => vc.clientId)
      .sort();
    expect(assigned).toEqual(["c1", "c2", "c3"]);
  });

  it("unassigning all clients leaves the visa with zero assignments and clears the mirror", async () => {
    const { setVisaClients } = await import("@/lib/data/visas");
    await setVisaClients("v1", []);

    expect(mockVisaClients.filter((vc) => vc.visaId === "v1")).toHaveLength(0);
    expect(mockVisas[0].clientId).toBe("");
  });
});

describe("visa data layer — transitionVisaStatus (mock mode)", () => {
  beforeEach(() => {
    mockVisas.push({
      id: "v1",
      clientId: "c1",
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 150,
      status: "pending",
      createdAt: "2026-09-30T10:00:00Z",
      updatedAt: "2026-09-30T10:00:00Z",
    });
    mockVisaStatusHistory.push({
      id: "vsh-initial",
      visaId: "v1",
      fromStatus: null,
      toStatus: "pending",
      changedAt: "2026-09-30T10:00:00Z",
    });
  });

  it("allows pending -> in_progress and appends a history entry", async () => {
    const { transitionVisaStatus, getVisaStatusHistory } = await import("@/lib/data/visas");
    const historyBefore = mockVisaStatusHistory.filter((h) => h.visaId === "v1").length;

    const entry = await transitionVisaStatus("v1", "in_progress");

    expect(entry.fromStatus).toBe("pending");
    expect(entry.toStatus).toBe("in_progress");
    expect(mockVisas[0].status).toBe("in_progress");
    const historyAfter = mockVisaStatusHistory.filter((h) => h.visaId === "v1");
    expect(historyAfter).toHaveLength(historyBefore + 1);
    expect(historyAfter.at(-1)).toMatchObject({
      visaId: "v1",
      fromStatus: "pending",
      toStatus: "in_progress",
    });

    const fetched = await getVisaStatusHistory("v1");
    expect(fetched.map((h) => h.toStatus)).toEqual(["pending", "in_progress"]);
  });

  it("allows in_progress -> completed and appends a history entry", async () => {
    mockVisas[0].status = "in_progress";
    mockVisaStatusHistory.push({
      id: "vsh-pending",
      visaId: "v1",
      fromStatus: null,
      toStatus: "pending",
      changedAt: "2026-09-30T10:00:00Z",
    });
    mockVisaStatusHistory.push({
      id: "vsh-in-progress",
      visaId: "v1",
      fromStatus: "pending",
      toStatus: "in_progress",
      changedAt: "2026-09-30T10:01:00Z",
    });

    const { transitionVisaStatus } = await import("@/lib/data/visas");
    const entry = await transitionVisaStatus("v1", "completed");

    expect(entry.fromStatus).toBe("in_progress");
    expect(entry.toStatus).toBe("completed");
    expect(mockVisas[0].status).toBe("completed");
  });

  it("rejects backward in_progress -> pending without status change or history append", async () => {
    mockVisas[0].status = "in_progress";
    const historyBefore = mockVisaStatusHistory.length;
    const { transitionVisaStatus } = await import("@/lib/data/visas");

    await expect(transitionVisaStatus("v1", "pending")).rejects.toThrow(/in_progress -> pending/);
    expect(mockVisas[0].status).toBe("in_progress");
    expect(mockVisaStatusHistory).toHaveLength(historyBefore);
  });

  it("rejects skip pending -> completed", async () => {
    const historyBefore = mockVisaStatusHistory.length;
    const { transitionVisaStatus } = await import("@/lib/data/visas");

    await expect(transitionVisaStatus("v1", "completed")).rejects.toThrow(/pending -> completed/);
    expect(mockVisas[0].status).toBe("pending");
    expect(mockVisaStatusHistory).toHaveLength(historyBefore);
  });

  it("rejects any transition from completed (terminal state)", async () => {
    mockVisas[0].status = "completed";
    const historyBefore = mockVisaStatusHistory.length;
    const { transitionVisaStatus } = await import("@/lib/data/visas");

    await expect(transitionVisaStatus("v1", "pending")).rejects.toThrow(/completed -> pending/);
    await expect(transitionVisaStatus("v1", "in_progress")).rejects.toThrow(/completed -> in_progress/);
    expect(mockVisas[0].status).toBe("completed");
    expect(mockVisaStatusHistory).toHaveLength(historyBefore);
  });
});
