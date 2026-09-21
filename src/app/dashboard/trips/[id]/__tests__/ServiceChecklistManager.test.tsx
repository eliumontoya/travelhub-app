import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { ServiceChecklistManager } from "../ServiceChecklistManager";
import type { ServiceDocumentSummary, ServiceWithChecklist } from "@/types";

const summaries: ServiceDocumentSummary[] = [
  {
    serviceId: "service-1",
    clientId: "client-1",
    processed: 2,
    total: 4,
    awaitingReview: 1,
  },
  {
    serviceId: "service-2",
    clientId: "client-2",
    processed: 0,
    total: 1,
    awaitingReview: 0,
  },
];

const getChecklist = vi.fn<() => Promise<ServiceWithChecklist>>();
const noOp = async () => {};

function renderManager(isArchived = false) {
  return renderToStaticMarkup(
    <ServiceChecklistManager
      tripId="trip-1"
      summaries={summaries}
      clientNameById={{ "client-1": "Ana López", "client-2": "Luis Pérez" }}
      isArchived={isArchived}
      getServiceChecklistAction={getChecklist}
      addChecklistItemAction={noOp}
      updateChecklistItemAction={noOp}
      deleteChecklistItemAction={noOp}
      reorderChecklistItemsAction={noOp}
      markUploadReviewedAction={noOp}
      requestReUploadAction={noOp}
    />,
  );
}

describe("ServiceChecklistManager", () => {
  it("renders compact progress and review counts without fetching checklist detail", () => {
    const html = renderManager();

    expect(html).toContain("Ana López");
    expect(html).toContain("2/4 revisados");
    expect(html).toContain("1 pendiente de revisión");
    expect(html).toContain("Luis Pérez");
    expect(html).toContain("0/1 revisados");
    expect(getChecklist).not.toHaveBeenCalled();
  });

  it("provides one accessible dialog without the all-travelers assignment form", () => {
    const html = renderManager();

    expect(html.match(/<dialog/g)).toHaveLength(1);
    expect(html).toContain('aria-labelledby="service-checklist-dialog-title"');
    expect(html).not.toContain("Asignar a todos los viajeros");
    expect(html).toContain("Documentos");
  });

  it("keeps archived summaries visible but removes every mutation control", () => {
    const html = renderManager(true);

    expect(html).toContain("Ana López");
    expect(html).toContain("2/4 revisados");
    expect(html).not.toContain("Asignar a todos los viajeros");
    expect(html).not.toContain("Agregar documento");
    expect(html).not.toContain("Marcar como revisado");
  });
});
