import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServiceWithChecklist, TripWithDetails } from "@/types";

vi.mock("@/lib/auth/roles", () => ({
  requireRole: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`__redirect__:${url}`);
  }),
}));

vi.mock("@/lib/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data")>()),
  addChecklistItemToTripServices: vi.fn(),
  createTrip: vi.fn(),
  createTripDay: vi.fn(),
  deleteTrip: vi.fn(),
  getServiceChecklistForTrip: vi.fn(),
  getServiceWithChecklist: vi.fn(),
  getServicesForTrip: vi.fn(),
  getTripById: vi.fn(),
  markUploadProcessed: vi.fn(),
  markUploadReviewed: vi.fn(),
  requestReUpload: vi.fn(),
  updateItem: vi.fn(),
  uploadTripPhoto: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/roles";
import {
  addChecklistItemToTripServices,
  createTrip,
  createTripDay,
  deleteTrip,
  getServiceChecklistForTrip,
  getServiceWithChecklist,
  getServicesForTrip,
  getTripById,
  markUploadReviewed,
  requestReUpload,
  updateItem,
  uploadTripPhoto,
} from "@/lib/data";
import {
  addChecklistItemToTripServicesAction,
  addDayAction,
  deleteTripAction,
  duplicateTripAction,
  editItemAction,
  getServiceChecklistForTripAction,
  markUploadReviewedAction,
  requestReUploadAction,
  uploadTripPhotoAction,
} from "../actions";

const publishedTrip = { id: "trip-1", status: "published" } as unknown as TripWithDetails;
const archivedTrip = { id: "trip-1", status: "archived" } as unknown as TripWithDetails;
const editableTrip = {
  id: "trip-1",
  status: "draft",
  title: "Rome",
  clients: [{ id: "client-1" }],
  tags: [],
  days: [],
} as unknown as TripWithDetails;

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
    await markUploadReviewedAction("trip-1", "upload-1");

    expect(markUploadReviewed).toHaveBeenCalledWith("upload-1");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/trips/trip-1");
  });

  it("does not transition an upload that is outside the trip boundary", async () => {
    vi.mocked(getServiceWithChecklist).mockResolvedValue({ ...service, items: [] });

    await expect(markUploadReviewedAction("trip-1", "foreign-upload")).rejects.toThrow(
      "El upload no pertenece al viaje"
    );
    expect(markUploadReviewed).not.toHaveBeenCalled();
  });

  it("keeps re-upload transitions agent-only and revalidates after the transition", async () => {
    const formData = new FormData();
    formData.set("comment", "Please upload a clearer scan");

    await requestReUploadAction("trip-1", "upload-1", formData);

    expect(requestReUpload).toHaveBeenCalledWith("upload-1", "Please upload a clearer scan");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/trips/trip-1");
  });
});

describe("trip detail authorization guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue("agent");
    vi.mocked(getTripById).mockResolvedValue(editableTrip);
    vi.mocked(getServiceChecklistForTrip).mockResolvedValue(service);
    vi.mocked(getServicesForTrip).mockResolvedValue([service]);
    vi.mocked(getServiceWithChecklist).mockResolvedValue(service);
    vi.mocked(createTripDay).mockResolvedValue(undefined as never);
    vi.mocked(updateItem).mockResolvedValue(undefined as never);
    vi.mocked(deleteTrip).mockResolvedValue(undefined as never);
    vi.mocked(uploadTripPhoto).mockResolvedValue(undefined as never);
    vi.mocked(createTrip).mockResolvedValue({ id: "trip-2" } as never);
    vi.mocked(addChecklistItemToTripServices).mockResolvedValue(undefined as never);
  });

  it("rejects addDayAction for an unauthorized caller before touching the trip", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("Unauthorized"));
    const formData = new FormData();
    formData.set("date", "2026-01-01");

    await expect(addDayAction("trip-1", formData)).rejects.toThrow("Unauthorized");
    expect(requireRole).toHaveBeenCalledWith("admin", "agent");
    // The trip is editable, but authorization must be checked first.
    expect(getTripById).not.toHaveBeenCalled();
    expect(createTripDay).not.toHaveBeenCalled();
  });

  it("rejects editItemAction for an unauthorized caller before writing", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("Unauthorized"));
    const formData = new FormData();
    formData.set("title", "Colosseum");

    await expect(editItemAction("trip-1", "item-1", formData)).rejects.toThrow("Unauthorized");
    expect(requireRole).toHaveBeenCalledWith("admin", "agent");
    expect(getTripById).not.toHaveBeenCalled();
    expect(updateItem).not.toHaveBeenCalled();
  });

  it("rejects deleteTripAction for an unauthorized caller before deleting", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("Unauthorized"));
    const formData = new FormData();
    formData.set("confirmTitle", "Rome");

    await expect(deleteTripAction("trip-1", formData)).rejects.toThrow("Unauthorized");
    expect(requireRole).toHaveBeenCalledWith("admin", "agent");
    expect(getTripById).not.toHaveBeenCalled();
    expect(deleteTrip).not.toHaveBeenCalled();
  });

  it("rejects uploadTripPhotoAction for an unauthorized caller before uploading", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("Unauthorized"));
    const formData = new FormData();
    formData.set("file", new File(["photo"], "photo.jpg"));

    await expect(uploadTripPhotoAction("trip-1", "rome", formData)).rejects.toThrow(
      "Unauthorized"
    );
    expect(requireRole).toHaveBeenCalledWith("admin", "agent");
    expect(getTripById).not.toHaveBeenCalled();
    expect(uploadTripPhoto).not.toHaveBeenCalled();
  });

  it("rejects duplicateTripAction for an unauthorized caller before cloning", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("Unauthorized"));

    await expect(duplicateTripAction("trip-1")).rejects.toThrow("Unauthorized");
    expect(requireRole).toHaveBeenCalledWith("admin", "agent");
    expect(getTripById).not.toHaveBeenCalled();
    expect(createTrip).not.toHaveBeenCalled();
  });

  it("rejects the already-guarded checklist getter for an unauthorized caller", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("Unauthorized"));

    await expect(getServiceChecklistForTripAction("trip-1", "service-1")).rejects.toThrow(
      "Unauthorized"
    );
    expect(getServiceChecklistForTrip).not.toHaveBeenCalled();
  });

  it("rejects a service-document action for an unauthorized caller even when editable", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("Unauthorized"));
    const formData = new FormData();
    formData.set("label", "Passport copy");

    await expect(addChecklistItemToTripServicesAction("trip-1", formData)).rejects.toThrow(
      "Unauthorized"
    );
    expect(requireRole).toHaveBeenCalledWith("admin", "agent");
    expect(getTripById).not.toHaveBeenCalled();
    expect(addChecklistItemToTripServices).not.toHaveBeenCalled();
  });

  it("runs addDayAction for an allowed role when the trip is editable", async () => {
    const formData = new FormData();
    formData.set("date", "2026-01-01");
    formData.set("notes", "Arrival");

    await addDayAction("trip-1", formData);

    expect(requireRole).toHaveBeenCalledWith("admin", "agent");
    expect(createTripDay).toHaveBeenCalledWith({
      tripId: "trip-1",
      date: "2026-01-01",
      notes: "Arrival",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/trips/trip-1");
  });

  it("runs deleteTripAction for an allowed role when the confirmation matches", async () => {
    const formData = new FormData();
    formData.set("confirmTitle", "Rome");

    await expect(deleteTripAction("trip-1", formData)).rejects.toThrow(/__redirect__/);

    expect(deleteTrip).toHaveBeenCalledWith("trip-1");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/trips");
  });

  it("runs duplicateTripAction for an allowed role and redirects to the clone", async () => {
    await expect(duplicateTripAction("trip-1")).rejects.toThrow(/__redirect__/);

    expect(createTrip).toHaveBeenCalled();
  });
});
