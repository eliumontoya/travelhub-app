import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Service, ServiceWithChecklist } from "@/types";

vi.mock("@/lib/client-auth", () => ({
  getClientSession: vi.fn(),
}));

vi.mock("@/lib/data/services", () => ({
  getServiceForClientTrip: vi.fn(),
  getServiceWithChecklist: vi.fn(),
  uploadServiceDocument: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { getClientSession } from "@/lib/client-auth";
import {
  getServiceForClientTrip,
  getServiceWithChecklist,
  uploadServiceDocument,
} from "@/lib/data/services";
import * as actions from "../actions";

const baseService: Service = {
  id: "svc1",
  tripId: "t1",
  clientId: "c1",
  serviceType: "trip_documents",
  status: "active",
  createdAt: "",
  updatedAt: "",
};

describe("client documents action surface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes only uploadDocument on the client action surface", () => {
    expect(Object.keys(actions).sort()).toEqual(["uploadDocument"]);
  });

  it("uploadDocument returns void and does not expose a raw storage path", async () => {
    vi.mocked(getClientSession).mockResolvedValue({
      clientId: "c1",
      expiresAt: Date.now() + 10000,
    });
    vi.mocked(getServiceWithChecklist).mockResolvedValue({
      ...baseService,
      items: [],
    } as ServiceWithChecklist);
    vi.mocked(getServiceForClientTrip).mockResolvedValue(baseService);
    vi.mocked(uploadServiceDocument).mockResolvedValue({
      id: "u1",
      serviceId: "svc1",
      checklistItemId: "sci1",
      filePath: "services/svc1/sci1/1234567890-doc.pdf",
      filename: "doc.pdf",
      mimeType: "application/pdf",
      status: "uploaded",
      fileRemoved: false,
      uploadedAt: "",
      updatedAt: "",
    });

    const file = new File(["x"], "doc.pdf", { type: "application/pdf" });
    const formData = new FormData();
    formData.append("file", file);

    const result = await actions.uploadDocument("svc1", "sci1", formData);

    expect(result).toBeUndefined();
    expect(uploadServiceDocument).toHaveBeenCalledWith("svc1", "sci1", file);
  });
});
