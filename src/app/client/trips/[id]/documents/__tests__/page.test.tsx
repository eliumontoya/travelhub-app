import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, ReactNode } from "react";
import type { ServiceChecklistItemWithUpload, ServiceWithChecklist } from "@/types";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("@/lib/client-auth", () => ({
  getClientSession: vi.fn(),
}));

vi.mock("@/lib/data/services", () => ({
  getServiceForClientTrip: vi.fn(),
  getServiceWithChecklist: vi.fn(),
}));

vi.mock("../actions", () => ({
  uploadDocument: vi.fn(),
}));

import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import {
  getServiceForClientTrip,
  getServiceWithChecklist,
} from "@/lib/data/services";

function getText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!isValidElement(node)) return "";
  const children = (node.props as Record<string, ReactNode>).children;
  if (Array.isArray(children)) return children.map(getText).join("");
  return getText(children);
}

function findForms(node: ReactNode): Array<{ text: string }> {
  const results: Array<{ text: string }> = [];
  function walk(n: ReactNode) {
    if (!isValidElement(n)) return;
    const type = n.type;
    const props = n.props as Record<string, unknown>;
    if (type === "form") {
      results.push({ text: getText(n) });
    }
    const children = props.children;
    if (Array.isArray(children)) children.forEach(walk);
    else walk(children as ReactNode);
  }
  walk(node);
  return results;
}

function findListItemsByLabel(node: ReactNode): Record<string, string> {
  const map: Record<string, string> = {};
  function walk(n: ReactNode) {
    if (!isValidElement(n)) return;
    const type = n.type;
    const props = n.props as Record<string, unknown>;
    if (type === "li") {
      const text = getText(n);
      const labelMatch = text.match(/(Visado|Seguro|Pasaporte|Comprobante)/);
      if (labelMatch) {
        map[labelMatch[1]] = text;
      }
    }
    const children = props.children;
    if (Array.isArray(children)) children.forEach(walk);
    else walk(children as ReactNode);
  }
  walk(node);
  return map;
}

const baseService: ServiceWithChecklist = {
  id: "svc1",
  tripId: "t1",
  clientId: "c1",
  serviceType: "trip_documents",
  status: "active",
  createdAt: "",
  updatedAt: "",
  items: [],
};

function checklistItem(
  id: string,
  label: string,
  sortOrder: number,
  status?: "uploaded" | "reviewed" | "processed" | "re_upload_requested",
  agentComment?: string
): ServiceChecklistItemWithUpload {
  const item: ServiceChecklistItemWithUpload = {
    id,
    serviceId: baseService.id,
    label,
    required: sortOrder === 0,
    sortOrder,
    createdAt: "",
    updatedAt: "",
  };
  if (status) {
    item.upload = {
      id: `u-${id}`,
      serviceId: baseService.id,
      checklistItemId: id,
      filePath: `services/svc1/${id}/100000000000${sortOrder}-${label.toLowerCase().replace(/\s+/g, "-")}.pdf`,
      filename: `${label.toLowerCase().replace(/\s+/g, "-")}.pdf`,
      mimeType: "application/pdf",
      status,
      agentComment,
      fileRemoved: status === "processed",
      uploadedAt: "",
      updatedAt: "",
      url: null,
    };
  }
  return item;
}

describe("/client/trips/[id]/documents page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to login when there is no session", async () => {
    vi.mocked(getClientSession).mockResolvedValue(null);

    const { default: Page } = await import("../page");

    await expect(Page({ params: Promise.resolve({ id: "t1" }) })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/client/login?redirectTo=/client");
  });

  it("redirects to the client home when the service is not found", async () => {
    vi.mocked(getClientSession).mockResolvedValue({
      clientId: "c1",
      expiresAt: Date.now() + 10000,
    });
    vi.mocked(getServiceForClientTrip).mockResolvedValue(null);

    const { default: Page } = await import("../page");

    await expect(Page({ params: Promise.resolve({ id: "t1" }) })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/client");
  });

  it("renders pending, uploaded, processed and re-upload-requested statuses distinctly", async () => {
    vi.mocked(getClientSession).mockResolvedValue({
      clientId: "c1",
      expiresAt: Date.now() + 10000,
    });
    vi.mocked(getServiceForClientTrip).mockResolvedValue(baseService);
    vi.mocked(getServiceWithChecklist).mockResolvedValue({
      ...baseService,
      items: [
        checklistItem("sci-pending", "Visado", 0),
        checklistItem("sci-uploaded", "Seguro", 1, "uploaded"),
        checklistItem("sci-processed", "Pasaporte", 2, "processed"),
        checklistItem("sci-reupload", "Comprobante", 3, "re_upload_requested", "Necesitamos copia más legible"),
      ],
    });

    const { default: Page } = await import("../page");
    const element = await Page({ params: Promise.resolve({ id: "t1" }) });
    const items = findListItemsByLabel(element);

    expect(items["Visado"]).toContain("⬜");
    expect(items["Visado"]).toContain("Pendiente");
    expect(items["Seguro"]).toContain("🔄");
    expect(items["Seguro"]).toContain("Pendiente de revisión");
    expect(items["Pasaporte"]).toContain("✅");
    expect(items["Pasaporte"]).toContain("Procesado");
    expect(items["Comprobante"]).toContain("⚠");
    expect(items["Comprobante"]).toContain("Re-subir solicitado");
    expect(items["Comprobante"]).toContain("Comentario del agente: Necesitamos copia más legible");
  });

  it("shows a 0/0 counter and an empty message when the checklist has no items", async () => {
    vi.mocked(getClientSession).mockResolvedValue({
      clientId: "c1",
      expiresAt: Date.now() + 10000,
    });
    vi.mocked(getServiceForClientTrip).mockResolvedValue(baseService);
    vi.mocked(getServiceWithChecklist).mockResolvedValue({
      ...baseService,
      items: [],
    });

    const { default: Page } = await import("../page");
    const element = await Page({ params: Promise.resolve({ id: "t1" }) });
    const text = getText(element);

    expect(text).toContain("0/0 completados");
    expect(text).toContain("Todavía no hay documentos solicitados para este viaje");
  });

  it("does not expose raw storage paths or URLs to the client", async () => {
    vi.mocked(getClientSession).mockResolvedValue({
      clientId: "c1",
      expiresAt: Date.now() + 10000,
    });
    vi.mocked(getServiceForClientTrip).mockResolvedValue(baseService);
    vi.mocked(getServiceWithChecklist).mockResolvedValue({
      ...baseService,
      items: [
        checklistItem("sci-processed", "Pasaporte", 0, "processed"),
        checklistItem("sci-uploaded", "Seguro", 1, "uploaded"),
        checklistItem("sci-reupload", "Comprobante", 2, "re_upload_requested", "Muy borroso"),
      ],
    });

    const { default: Page } = await import("../page");
    const element = await Page({ params: Promise.resolve({ id: "t1" }) });
    const text = getText(element);

    expect(text).not.toContain("services/");
    expect(text).not.toContain("pasaporte.pdf");
    expect(text).not.toContain("seguro.pdf");
    expect(text).not.toContain("comprobante.pdf");
    expect(text).not.toContain("trip-documents");
    expect(text).not.toContain("http");
  });

  it("only offers the upload form for items that can be uploaded (pending or re-upload requested)", async () => {
    vi.mocked(getClientSession).mockResolvedValue({
      clientId: "c1",
      expiresAt: Date.now() + 10000,
    });
    vi.mocked(getServiceForClientTrip).mockResolvedValue(baseService);
    vi.mocked(getServiceWithChecklist).mockResolvedValue({
      ...baseService,
      items: [
        checklistItem("sci-pending", "Visado", 0),
        checklistItem("sci-uploaded", "Seguro", 1, "uploaded"),
        checklistItem("sci-processed", "Pasaporte", 2, "processed"),
        checklistItem("sci-reupload", "Comprobante", 3, "re_upload_requested", "Muy borroso"),
      ],
    });

    const { default: Page } = await import("../page");
    const element = await Page({ params: Promise.resolve({ id: "t1" }) });
    const forms = findForms(element);
    const formTexts = forms.map((f) => f.text).join(" ");

    expect(formTexts).toContain("Visado");
    expect(formTexts).toContain("Comprobante");
    expect(formTexts).not.toContain("Seguro");
    expect(formTexts).not.toContain("Pasaporte");
  });
});
