import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { VisaDocumentsPanel } from "../VisaDocumentsPanel";
import type { VisaDocument } from "@/types";

type DocumentItem = VisaDocument & { url: string | null };

function makeDocument(overrides: Partial<DocumentItem> = {}): DocumentItem {
  return {
    id: "d1",
    visaId: "v1",
    targetClientId: null,
    filePath: "visa-docs/pasaporte.pdf",
    filename: "pasaporte.pdf",
    status: "uploaded",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    url: "https://example.com/pasaporte.pdf",
    ...overrides,
  };
}

const sampleClient = {
  id: "c1",
  name: "Ana Pérez",
  email: "ana@example.com",
  phone: "+52 55 0000 0000",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderPanel(documents: DocumentItem[]) {
  return renderToStaticMarkup(
    <VisaDocumentsPanel
      visaId="v1"
      initialDocuments={documents}
      assignedClients={[sampleClient]}
    />,
  );
}

describe("VisaDocumentsPanel", () => {
  it("renders upload and request forms in Spanish", () => {
    const html = renderPanel([]);

    expect(html).toContain("Subir un documento en nombre del viajero");
    expect(html).toContain("Subir");
    expect(html).toContain("Solicitar un documento a un viajero");
    expect(html).toContain("Solicitar documento");
    expect(html).toContain("Selecciona un viajero");
    expect(html).toContain("Documentos en archivo");
    expect(html).toContain("No hay documentos adjuntos todavía.");
  });

  it("renders the document list with Spanish status labels", () => {
    const html = renderPanel([
      makeDocument({ status: "uploaded", filename: "pasaporte.pdf" }),
      makeDocument({
        id: "d2",
        status: "requested",
        filename: undefined,
        filePath: null,
        url: null,
        description: "Escaneo del pasaporte",
      }),
    ]);

    expect(html).toContain('data-testid="visa-document-list"');
    expect(html).toContain("pasaporte.pdf");
    expect(html).toContain("Escaneo del pasaporte");
    expect(html).toContain("Subido");
    expect(html).toContain("Solicitado al viajero");
    expect(html).toContain("Marcar revisado");
    expect(html).toContain("Marcar procesado");
  });
});
