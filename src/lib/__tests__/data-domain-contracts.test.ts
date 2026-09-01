import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => false,
  createClient: vi.fn(),
}));

import * as dataFacade from "@/lib/data";
import { createClient, getClientById, getClientsWithTags, getOrCreateTag, setClientTags } from "@/lib/data/clients";
import { createDocument, getSignedDocumentUrl, uploadItemDocument } from "@/lib/data/documents";
import { createItem, createTrip, createTripDay, getTripWithDetails } from "@/lib/data/trips";

describe("data-layer domain boundary contracts", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("keeps the data facade as the stable named export surface", () => {
    expect(dataFacade.createClient).toBe(createClient);
    expect(dataFacade.getTripWithDetails).toBe(getTripWithDetails);
    expect(dataFacade.createDocument).toBe(createDocument);
    expect(dataFacade.DEFAULT_PAGE_SIZE).toBe(20);
  });

  it("preserves mock client and tag association behavior through the client domain", async () => {
    const unique = `Domain Client ${Date.now()}`;
    const client = await createClient({
      name: unique,
      email: `${unique.toLowerCase().replaceAll(" ", ".")}@example.com`,
      phone: "+52 55 1000 2000",
      whatsapp: "",
      notes: "<script>alert(1)</script><strong>VIP</strong>",
    });
    const tag = await getOrCreateTag(`Domain Tag ${Date.now()}`);

    await setClientTags(client.id, [tag.id]);

    const found = await getClientById(client.id);
    const tagged = await getClientsWithTags({ page: 1, pageSize: 5 });
    const taggedClient = tagged.items.find((item) => item.id === client.id);

    expect(found).toMatchObject({
      id: client.id,
      name: unique,
      whatsapp: "+52 55 1000 2000",
    });
    expect(found?.notes).toBe("<strong>VIP</strong>");
    expect(taggedClient?.tags.map((item) => item.name)).toEqual([tag.name]);
  });

  it("preserves mock trip detail assembly through the trips domain", async () => {
    const client = await createClient({ name: `Domain Traveler ${Date.now()}` });
    const slug = `domain-trip-${Date.now()}`;
    const trip = await createTrip({
      clientIds: [client.id],
      title: "Domain Contract Trip",
      slug,
      startDate: "2026-11-01",
      endDate: "2026-11-02",
    });
    const day = await createTripDay({ tripId: trip.id, date: "2026-11-01", sortOrder: 3 });
    const item = await createItem({
      tripDayId: day.id,
      type: "activity",
      title: "Museum visit",
      startTime: "10:00",
      sortOrder: 4,
      notes: "Bring voucher",
    });

    const details = await getTripWithDetails(slug);

    expect(details?.id).toBe(trip.id);
    expect(details?.clients.map((assigned) => assigned.id)).toEqual([client.id]);
    expect(details?.days).toHaveLength(1);
    expect(details?.days[0]).toMatchObject({ id: day.id, sortOrder: 3 });
    expect(details?.days[0].items).toEqual([expect.objectContaining({ id: item.id, title: "Museum visit" })]);
  });

  it("preserves mock document and storage contracts through the documents domain", async () => {
    const document = await createDocument({
      itemId: "domain-item-1",
      fileUrl: "domain-item-1/voucher.pdf",
      fileName: "voucher.pdf",
      mimeType: "application/pdf",
    });

    await expect(getSignedDocumentUrl(document.fileUrl)).resolves.toBeNull();
    await expect(uploadItemDocument("domain-item-1", new File(["pdf"], "voucher.pdf"))).rejects.toThrow(
      "Supabase no está configurado"
    );
    expect(document).toMatchObject({
      itemId: "domain-item-1",
      fileUrl: "domain-item-1/voucher.pdf",
      fileName: "voucher.pdf",
      mimeType: "application/pdf",
    });
    expect(document.uploadedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
