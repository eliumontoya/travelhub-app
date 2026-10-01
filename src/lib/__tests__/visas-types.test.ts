import { describe, it, expect } from "vitest";
import type {
  Client,
  Feature,
  Visa,
  VisaStatus,
  VisaFilters,
  VisaStatusHistoryEntry,
  VisaDocumentStatus,
  VisaDocument,
  VisaWithDetails,
} from "@/types";

describe("visa domain types", () => {
  it("Feature union recognizes visas", () => {
    const feature: Feature = "visas";
    expect(feature).toBe("visas");
  });

  it("VisaStatus supports the full lifecycle", () => {
    const statuses: VisaStatus[] = ["pending", "in_progress", "completed"];
    expect(statuses).toEqual(["pending", "in_progress", "completed"]);
  });

  it("Visa object conforms to the documented contract", () => {
    const visa: Visa = {
      id: "v1",
      clientId: "c1",
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 150,
      notes: "Sample visa",
      status: "pending",
      createdAt: "2026-09-30T00:00:00Z",
      updatedAt: "2026-09-30T00:00:00Z",
    };

    expect(visa.id).toBe("v1");
    expect(visa.country).toBe("France");
    expect(visa.visaType).toBe("Tourist");
    expect(visa.deadline).toBe("2026-12-01");
    expect(visa.price).toBe(150);
    expect(visa.status).toBe("pending");
  });

  it("VisaFilters accepts status, client, country and query filters", () => {
    const filters: VisaFilters = {
      query: "France",
      status: ["pending", "in_progress"],
      clientIds: ["c1", "c2"],
      country: "France",
    };

    expect(filters.status).toEqual(["pending", "in_progress"]);
    expect(filters.clientIds).toEqual(["c1", "c2"]);
    expect(filters.country).toBe("France");
    expect(filters.query).toBe("France");
  });

  it("VisaStatusHistoryEntry records from and to statuses", () => {
    const entry: VisaStatusHistoryEntry = {
      id: "vsh1",
      visaId: "v1",
      fromStatus: null,
      toStatus: "pending",
      changedAt: "2026-09-30T00:00:00Z",
    };

    expect(entry.fromStatus).toBeNull();
    expect(entry.toStatus).toBe("pending");
    expect(entry.visaId).toBe("v1");
  });

  it("VisaDocumentStatus supports the document lifecycle", () => {
    const statuses: VisaDocumentStatus[] = [
      "requested",
      "uploaded",
      "reviewed",
      "processed",
      "re_upload_requested",
    ];

    expect(statuses).toEqual([
      "requested",
      "uploaded",
      "reviewed",
      "processed",
      "re_upload_requested",
    ]);
  });

  it("VisaDocument supports agent uploads and traveler requests", () => {
    const agentDoc: VisaDocument = {
      id: "vd1",
      visaId: "v1",
      targetClientId: null,
      filePath: "visas/v1/file.pdf",
      filename: "file.pdf",
      mimeType: "application/pdf",
      status: "uploaded",
      uploadedAt: "2026-09-30T00:00:00Z",
      createdAt: "2026-09-30T00:00:00Z",
      updatedAt: "2026-09-30T00:00:00Z",
    };

    const requestedDoc: VisaDocument = {
      id: "vd2",
      visaId: "v1",
      targetClientId: "c1",
      description: "Passport scan",
      filePath: null,
      status: "requested",
      createdAt: "2026-09-30T00:00:00Z",
      updatedAt: "2026-09-30T00:00:00Z",
    };

    expect(agentDoc.targetClientId).toBeNull();
    expect(agentDoc.filePath).toBe("visas/v1/file.pdf");
    expect(requestedDoc.targetClientId).toBe("c1");
    expect(requestedDoc.filePath).toBeNull();
    expect(requestedDoc.description).toBe("Passport scan");
  });

  it("VisaWithDetails extends Visa with clients, history and documents", () => {
    const visaWithDetails: VisaWithDetails = {
      id: "v1",
      clientId: "c1",
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 150,
      status: "pending",
      createdAt: "2026-09-30T00:00:00Z",
      updatedAt: "2026-09-30T00:00:00Z",
      clients: [],
      client: {} as Client,
      statusHistory: [],
      documents: [],
    };

    expect(visaWithDetails.clients).toEqual([]);
    expect(visaWithDetails.statusHistory).toEqual([]);
    expect(visaWithDetails.documents).toEqual([]);
  });
});
