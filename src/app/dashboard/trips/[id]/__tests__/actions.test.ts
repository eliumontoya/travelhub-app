import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServiceWithChecklist, TripWithDetails } from "@/types";

vi.mock("@/lib/auth/roles", () => ({
  requireRole: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data")>()),
  addChecklistItemToTripServices: vi.fn(),
  getServiceChecklistForTrip: vi.fn(),
  getServiceWithChecklist: vi.fn(),
  getServicesForTrip: vi.fn(),
  getTripById: vi.fn(),
  markUploadProcessed: vi.fn(),
  requestReUpload: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/roles";
import {
  addChecklistItemToTripServices,
  getServiceChecklistForTrip,
  getServiceWithChecklist,
  getServicesForTrip,
  getTripById,
  markUploadProcessed,
  requestReUpload,
} from "@/lib/data";
import {
  addChecklistItemToTripServicesAction,
  getServiceChecklistForTripAction,
  markUploadProcessedAction,
  requestReUploadAction,
} from "../actions";

const publishedTrip = { id: "trip-1", status: "published" } as unknown as TripWithDetails;
const archivedTrip = { id: "trip-1", status: "archived" } as unknown as TripWithDetails;
const service = {
  id: "service-1",
  tripId: "trip-1",
  clientId: "client-1",
  serviceType: "trip_documents",
  status: "active",
  createdAt: "",
  updatedAt: "",
  items: [
    {
      id: "item-1",
      serviceId: "service-1",
      label: "Passport",
      required: true,
      sortOrder: 0,
      createdAt: "",
      updatedAt: "",
      upload: {
        id: "upload-1",
        serviceId: "service-1",
        checklistItemId: "item-1",
        filePath: "services/service-1/item-1/passport.pdf",
        filename: "passport.pdf",
        status: "uploaded" as const,
        fileRemoved: false,
        uploadedAt: "",
        updatedAt: "",
        url: null,
      },
    },
  ],
} satisfies ServiceWithChecklist;

describe("service document actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue("agent");
    vi.mocked(getTripById).mockResolvedValue(publishedTrip);
    vi.mocked(getServiceChecklistForTrip).mockResolvedValue(service);
    vi.mocked(getServicesForTrip).mockResolvedValue([service]);
    vi.mocked(getServiceWithChecklist).mockResolvedValue(service);
  });

  it("returns only the trip-scoped detail for an authorized agent", async () => {
    await expect(getServiceChecklistForTripAction("trip-1", "service-1")).resolves.toBe(service);
    expect(requireRole).toHaveBeenCalledWith("admin", "agent");
    expect(getServiceChecklistForTrip).toHaveBeenCalledWith("trip-1", "service-1");
  });

  it("allows bulk assignment on a published trip and revalidates the dashboard", async () => {
    const formData = new FormData();
    formData.set("label", "Passport copy");
    formData.set("required", "true");

    await addChecklistItemToTripServicesAction("trip-1", formData);

    expect(addChecklistItemToTripServices).toHaveBeenCalledWith("trip-1", {
      label: "Passport copy",
      required: true,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/trips/trip-1");
  });

  it("rejects bulk assignment on an archived trip before writing", async () => {
    vi.mocked(getTripById).mockResolvedValue(archivedTrip);
    const formData = new FormData();
    formData.set("label", "Passport copy");

    await expect(addChecklistItemToTripServicesAction("trip-1", formData)).rejects.toThrow(
      "El viaje archivado es de solo lectura"
    );
    expect(addChecklistItemToTripServices).not.toHaveBeenCalled();
  });

  it("allows published upload review only when the upload belongs to the trip", async () => {
    await markUploadProcessedAction("trip-1", "upload-1");

    expect(markUploadProcessed).toHaveBeenCalledWith("upload-1");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/trips/trip-1");
  });

  it("does not transition an upload that is outside the trip boundary", async () => {
    vi.mocked(getServiceWithChecklist).mockResolvedValue({ ...service, items: [] });

    await expect(markUploadProcessedAction("trip-1", "foreign-upload")).rejects.toThrow(
      "El upload no pertenece al viaje"
    );
    expect(markUploadProcessed).not.toHaveBeenCalled();
  });

  it("keeps re-upload transitions agent-only and revalidates after the transition", async () => {
    const formData = new FormData();
    formData.set("comment", "Please upload a clearer scan");

    await requestReUploadAction("trip-1", "upload-1", formData);

    expect(requestReUpload).toHaveBeenCalledWith("upload-1", "Please upload a clearer scan");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/trips/trip-1");
  });
});
