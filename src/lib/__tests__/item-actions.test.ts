import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createItem: vi.fn(),
  updateItem: vi.fn(),
  revalidatePath: vi.fn(),
  getTripById: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/data", () => ({
  createItem: mocks.createItem,
  createTrip: vi.fn(),
  createPackingItem: vi.fn(),
  createTripDay: vi.fn(),
  deleteDocument: vi.fn(),
  deleteItem: vi.fn(),
  deletePackingItem: vi.fn(),
  deleteTripDay: vi.fn(),
  deleteTripPhoto: vi.fn(),
  generateTripDays: vi.fn(),
  getItemDocuments: vi.fn(),
  getOrCreateTag: vi.fn(),
  getTripById: mocks.getTripById,
  reorderItems: vi.fn(),
  reorderTripDays: vi.fn(),
  restoreItem: vi.fn(),
  restoreTripDay: vi.fn(),
  saveTripAsTemplate: vi.fn(),
  setTripClients: vi.fn(),
  setTripTags: vi.fn(),
  updateItem: mocks.updateItem,
  updatePackingItem: vi.fn(),
  updateTrip: vi.fn(),
  updateTripDay: vi.fn(),
  updateTripInternalNotes: vi.fn(),
  uploadItemDocument: vi.fn(),
  uploadTripPhoto: vi.fn(),
}));

import { addItemAction, editItemAction } from "@/app/dashboard/trips/[id]/actions";

describe("item server action metadata validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("rejects invalid metadata and does not save", async () => {
    mocks.getTripById.mockResolvedValueOnce({ id: "trip-1", status: "draft" });
    const formData = new FormData();
    formData.set("type", "flight");
    formData.set("title", "AA 1234");
    formData.set("metadata", JSON.stringify({ airline: "AA" }));

    await expect(editItemAction("trip-1", "item-1", formData)).rejects.toThrow("Datos del item inválidos");

    expect(mocks.updateItem).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("saves explicit null metadata for legacy action submissions", async () => {
    const formData = new FormData();
    formData.set("type", "note");
    formData.set("title", "Nota");
    formData.set("metadata", "null");
    mocks.getTripById.mockResolvedValueOnce({ id: "trip-1", status: "draft" });
    mocks.createItem.mockResolvedValueOnce({ id: "item-1" });

    await addItemAction("trip-1", "day-1", formData);

    expect(mocks.createItem).toHaveBeenCalledWith(expect.objectContaining({
      tripDayId: "day-1",
      type: "note",
      title: "Nota",
      metadata: null,
    }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/trips/trip-1");
  });

  it("blocks edits when the trip is published", async () => {
    const formData = new FormData();
    formData.set("type", "note");
    formData.set("title", "Nota");
    mocks.getTripById.mockResolvedValueOnce({ id: "trip-1", status: "published" });

    await expect(addItemAction("trip-1", "day-1", formData)).rejects.toThrow("viaje publicado está bloqueado");

    expect(mocks.createItem).not.toHaveBeenCalled();
  });
});
