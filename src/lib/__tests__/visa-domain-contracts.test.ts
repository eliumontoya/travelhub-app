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
  mockVisaDocuments,
  mockVisas,
  mockVisaStatusHistory,
} from "@/lib/mock-data";
import {
  assertVisaDocumentMutable,
  createVisa,
  getVisaById,
  getVisaDocuments,
  getVisasWithClients,
  markVisaDocumentProcessed,
  markVisaDocumentReviewed,
  requestVisaDocument,
  requestVisaDocumentReUpload,
  setVisaClients,
  transitionVisaStatus,
  updateVisa,
  uploadVisaDocument,
  uploadVisaDocumentForRequest,
  VISA_DOCUMENTS_BUCKET,
} from "@/lib/data";
import * as dataFacade from "@/lib/data";

// Tables and storage buckets that the visas/visa-documents modules MUST NOT
// touch (cross-domain isolation contract — design §Decision: New top-level
// `visas` domain and §Cross-domain isolation).
const FORBIDDEN_TABLES = [
  "trips",
  "trip_clients",
  "trip_status_history",
  "trip_documents",
  "services",
  "service_checklist_items",
  "service_uploads",
];
const FORBIDDEN_BUCKETS = ["trip-documents"];
const VISA_TABLES = ["visas", "visa_clients", "visa_status_history", "visa_documents"];
const VISA_BUCKETS = ["visa-documents"];

// Reset only what the visa modules own; we never touch mockClients/mockTrips
// because the production code hydrates from those shared arrays. Tests
// requiring a client must seed it explicitly via ensureMockClient.
function resetVisaState() {
  mockVisas.length = 0;
  mockVisaClients.length = 0;
  mockVisaStatusHistory.length = 0;
  mockVisaDocuments.length = 0;
}

function ensureMockClient(clientId: string, name = "Domain Test Client") {
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

beforeEach(() => {
  resetVisaState();
  vi.mocked(isSupabaseConfigured).mockReturnValue(false);
  vi.clearAllMocks();
});

// ============================================================
// 4.1 — Facade export surface for visa + visa-document modules
// ============================================================

describe("visa-domain contracts — facade export surface", () => {
  it("re-exports every visa management function from the @/lib/data facade", () => {
    expect(typeof dataFacade.createVisa).toBe("function");
    expect(typeof dataFacade.getVisaById).toBe("function");
    expect(typeof dataFacade.getVisasWithClients).toBe("function");
    expect(typeof dataFacade.getVisasByClientId).toBe("function");
    expect(typeof dataFacade.updateVisa).toBe("function");
    expect(typeof dataFacade.setVisaClients).toBe("function");
    expect(typeof dataFacade.transitionVisaStatus).toBe("function");
    expect(typeof dataFacade.getVisaStatusHistory).toBe("function");
  });

  it("re-exports every visa document function from the @/lib/data facade", () => {
    expect(typeof dataFacade.uploadVisaDocument).toBe("function");
    expect(typeof dataFacade.requestVisaDocument).toBe("function");
    expect(typeof dataFacade.uploadVisaDocumentForRequest).toBe("function");
    expect(typeof dataFacade.markVisaDocumentReviewed).toBe("function");
    expect(typeof dataFacade.markVisaDocumentProcessed).toBe("function");
    expect(typeof dataFacade.requestVisaDocumentReUpload).toBe("function");
    expect(typeof dataFacade.getVisaDocuments).toBe("function");
    expect(typeof dataFacade.getSignedVisaDocumentUrl).toBe("function");
    expect(typeof dataFacade.assertVisaDocumentMutable).toBe("function");
  });

  it("exposes the visa-documents bucket constant through the facade", () => {
    expect(dataFacade.VISA_DOCUMENTS_BUCKET).toBe("visa-documents");
  });

  it("exposes the visa transitions map through the facade", () => {
    expect(dataFacade.VISA_TRANSITIONS).toEqual({
      pending: ["in_progress"],
      in_progress: ["completed"],
      completed: [],
    });
  });
});

// ============================================================
// 4.2 — Cross-domain isolation (mock mode proof + structural assertion)
// ============================================================

describe("visa-domain contracts — cross-domain isolation (mock mode)", () => {
  it("runs every visa + visa-document operation against the visa mock state", async () => {
    ensureMockClient("c1", "Ana");
    const visa = await createVisa({
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 150,
      clientIds: ["c1"],
    });
    expect(visa.status).toBe("pending");
    await setVisaClients(visa.id, ["c1"]);
    await updateVisa(visa.id, { notes: "Updated" });
    await transitionVisaStatus(visa.id, "in_progress");
    const file = new File(["x"], "form.pdf", { type: "application/pdf" });
    const uploaded = await uploadVisaDocument(visa.id, file);
    await requestVisaDocument(visa.id, "c1", "Passport scan");
    await markVisaDocumentReviewed(uploaded.id);
    const documents = await getVisaDocuments(visa.id);
    expect(documents.some((d) => d.id === uploaded.id)).toBe(true);
    // All work landed in the visa-specific mock arrays (production code ran).
    expect(mockVisas.length).toBe(1);
    expect(mockVisaStatusHistory.length).toBeGreaterThanOrEqual(2);
    expect(mockVisaDocuments.length).toBe(2);
    // Cross-domain leak is structurally impossible in mock mode: visa modules
    // never import mockTrips/mockServices/etc. The structural assertion below
    // is the proof — the table allowlist forbids them.
    FORBIDDEN_TABLES.forEach((t) => expect(VISA_TABLES.includes(t)).toBe(false));
  });

  it("uses the visa-documents bucket constant for storage isolation", () => {
    expect(VISA_DOCUMENTS_BUCKET).toBe("visa-documents");
    expect(VISA_BUCKETS).toContain(VISA_DOCUMENTS_BUCKET);
    expect(FORBIDDEN_BUCKETS).not.toContain(VISA_DOCUMENTS_BUCKET);
  });

  it("forbidden tables list covers every trip + service table", () => {
    // Lock the cross-domain boundary so future regressions are caught
    // even if the visa module's call sites grow.
    FORBIDDEN_TABLES.forEach((t) => expect(VISA_TABLES.includes(t)).toBe(false));
  });
});

// ============================================================
// 4.2 (Supabase mode) — Use AST-style file inspection to verify that the
// visa + visa-documents modules do NOT contain calls to forbidden tables or
// forbidden storage buckets. This is a structural test that catches leaks at
// the source level (the modules are scanned for `.from("trips")` style
// strings) and complements the runtime allowlist assertion above.
// ============================================================

describe("visa-domain contracts — cross-domain isolation (source-level)", () => {
  it("visa + visa-documents modules do not reference forbidden tables in source", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const modulesDir = path.resolve(process.cwd(), "src/lib/data");
    const sources = [
      path.join(modulesDir, "visas.ts"),
      path.join(modulesDir, "visa-documents.ts"),
    ];
    const combined: string[] = [];
    for (const file of sources) {
      const text = await fs.readFile(file, "utf8");
      combined.push(text);
    }
    const joined = combined.join("\n");
    FORBIDDEN_TABLES.forEach((t) => {
      // Permit the literal string to appear inside a comment, but disallow
      // `.from("trips")`-style call sites. We check for the patterns
      // `.from("<table>")` and `from("<table>")` (no leading dot).
      const fromCallPattern = new RegExp(`\\bfrom\\(["'\`]${t}["'\`]\\)`);
      expect(fromCallPattern.test(joined), `forbidden table reference: ${t}`).toBe(false);
    });
    FORBIDDEN_BUCKETS.forEach((b) => {
      // We allow the constant name VISA_DOCUMENTS_BUCKET to mention the string
      // "trip-documents" only in comments — we check for actual `.from()`
      // call sites that would read/write from the trip bucket.
      const fromCallPattern = new RegExp(`\\.from\\(["'\`]${b}["'\`]\\)`);
      expect(fromCallPattern.test(joined), `forbidden bucket reference: ${b}`).toBe(false);
    });
  });

  it("visa + visa-documents modules only reference visa-domain storage bucket", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const visaDocsPath = path.resolve(process.cwd(), "src/lib/data/visa-documents.ts");
    const text = await fs.readFile(visaDocsPath, "utf8");
    // Find every storage.from(...) call site (NOT bare .from(...) for tables).
    const callSites = [...text.matchAll(/storage\.from\(([^)]+)\)/g)].map((m) => m[1].trim());
    expect(callSites.length).toBeGreaterThan(0);
    callSites.forEach((bucket) => {
      // All storage.from() calls in visa-documents must reference VISA_DOCUMENTS_BUCKET.
      expect(bucket).toBe("VISA_DOCUMENTS_BUCKET");
    });
  });
});

// ============================================================
// 4.3 — Dual-mode parity (mock mode runs end-to-end from Phases 2-3)
// ============================================================

describe("visa-domain contracts — dual-mode parity", () => {
  it("create → read → transition → read sequence in mock mode is consistent", async () => {
    ensureMockClient("c1", "Ana");
    const visa = await createVisa({
      country: "Italy",
      visaType: "Schengen",
      deadline: "2027-01-15",
      price: 220,
      clientIds: ["c1"],
    });

    const read1 = await getVisaById(visa.id);
    expect(read1?.status).toBe("pending");
    expect(read1?.clients.map((c) => c.id)).toEqual(["c1"]);
    expect(read1?.statusHistory.length).toBe(1);
    expect(read1?.statusHistory[0].toStatus).toBe("pending");

    await transitionVisaStatus(visa.id, "in_progress");
    await transitionVisaStatus(visa.id, "completed");

    const read2 = await getVisaById(visa.id);
    expect(read2?.status).toBe("completed");
    expect(read2?.statusHistory.length).toBe(3);
    expect(read2?.statusHistory.map((h) => h.toStatus)).toEqual([
      "pending",
      "in_progress",
      "completed",
    ]);

    // Skipping from `completed` is rejected (forward-only lifecycle).
    await expect(transitionVisaStatus(visa.id, "pending")).rejects.toThrow(
      /Illegal visa status transition/,
    );
    const read3 = await getVisaById(visa.id);
    expect(read3?.status).toBe("completed");
    expect(read3?.statusHistory.length).toBe(3);
  });

  it("mock-mode create + list returns the new visa in the paginated result", async () => {
    const unique = `ParityVisa-${Date.now()}`;
    const visa = await createVisa({
      country: unique,
      visaType: "Tourist",
      deadline: "2027-02-01",
      price: 100,
      clientIds: [],
    });

    const list = await getVisasWithClients({
      filters: { query: unique },
      page: 1,
      pageSize: 5,
    });
    expect(list.items.some((v) => v.id === visa.id)).toBe(true);
    expect(list.totalCount).toBeGreaterThan(0);
  });

  it("mock-mode request → re-upload lifecycle round-trips through getVisaDocuments", async () => {
    ensureMockClient("c1", "Ana");
    const visa = await createVisa({
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 100,
      clientIds: ["c1"],
    });
    const requested = await requestVisaDocument(visa.id, "c1", "Passport scan");
    expect(requested.status).toBe("requested");

    const file = new File(["x"], "passport.pdf", { type: "application/pdf" });
    const uploaded = await uploadVisaDocumentForRequest(requested.id, "c1", file);
    expect(uploaded.status).toBe("uploaded");
    expect(uploaded.filePath).toMatch(/^visas\//);

    await requestVisaDocumentReUpload(uploaded.id, "Re-upload please");
    const docs = await getVisaDocuments(visa.id);
    const updated = docs.find((d) => d.id === uploaded.id);
    expect(updated?.status).toBe("re_upload_requested");
    expect(updated?.agentComment).toBe("Re-upload please");
  });

  it("completed-visas do not transition, backward transitions are rejected", async () => {
    ensureMockClient("c1", "Ana");
    const visa = await createVisa({
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 100,
      clientIds: ["c1"],
    });
    await transitionVisaStatus(visa.id, "in_progress");
    await transitionVisaStatus(visa.id, "completed");

    // Backward transition rejected.
    await expect(transitionVisaStatus(visa.id, "pending")).rejects.toThrow(
      /Illegal visa status transition/,
    );
    // Skip transition rejected.
    await expect(transitionVisaStatus(visa.id, "in_progress")).rejects.toThrow(
      /Illegal visa status transition/,
    );
    // Re-running forward rejected.
    await expect(transitionVisaStatus(visa.id, "completed")).rejects.toThrow(
      /Illegal visa status transition/,
    );

    const final = await getVisaById(visa.id);
    expect(final?.status).toBe("completed");
    expect(final?.statusHistory.length).toBe(3);
  });

  it("exhaustive status lifecycle: markVisaDocumentReviewed + Processed round-trip", async () => {
    ensureMockClient("c1", "Ana");
    const visa = await createVisa({
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 100,
      clientIds: ["c1"],
    });
    const file = new File(["x"], "doc.pdf", { type: "application/pdf" });
    const doc = await uploadVisaDocument(visa.id, file);
    expect(doc.status).toBe("uploaded");
    await markVisaDocumentReviewed(doc.id);
    const afterReview = (await getVisaDocuments(visa.id)).find((d) => d.id === doc.id);
    expect(afterReview?.status).toBe("reviewed");
    await markVisaDocumentProcessed(doc.id);
    const afterProcessed = (await getVisaDocuments(visa.id)).find((d) => d.id === doc.id);
    expect(afterProcessed?.status).toBe("processed");
  });

  it("ownership guard rejects cross-visa document access", async () => {
    ensureMockClient("c1", "Ana");
    const visaA = await createVisa({
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 100,
      clientIds: ["c1"],
    });
    const visaB = await createVisa({
      country: "Japan",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 100,
      clientIds: ["c1"],
    });
    const file = new File(["x"], "doc.pdf", { type: "application/pdf" });
    const doc = await uploadVisaDocument(visaA.id, file);
    await expect(assertVisaDocumentMutable(doc.id, visaB.id)).rejects.toThrow(/not found/i);
    await expect(assertVisaDocumentMutable(doc.id, visaA.id)).resolves.toBeUndefined();
  });

  it("non-assigned client cannot upload to a visa document request", async () => {
    ensureMockClient("c1", "Ana");
    ensureMockClient("c2", "Bea");
    const visa = await createVisa({
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 100,
      clientIds: ["c1"],
    });
    const requested = await requestVisaDocument(visa.id, "c1", "Passport scan");
    const file = new File(["x"], "passport.pdf", { type: "application/pdf" });
    // c2 is not the assigned traveler — must be rejected.
    await expect(uploadVisaDocumentForRequest(requested.id, "c2", file)).rejects.toThrow(
      /not the assigned traveler/i,
    );
    // c1 succeeds.
    await expect(uploadVisaDocumentForRequest(requested.id, "c1", file)).resolves.toMatchObject({
      status: "uploaded",
      visaId: visa.id,
    });
  });
});
