import { describe, it, expect, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { getTripById, uploadTripCoverImage, removeTripCoverImage } from "@/lib/data";

vi.mock("@/lib/data", async () => {
  const actual = await vi.importActual<typeof import("@/lib/data")>("@/lib/data");
  return {
    ...actual,
    uploadTripCoverImage: vi.fn(),
    removeTripCoverImage: vi.fn(),
    getTripById: vi.fn(),
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import * as actions from "@/app/dashboard/trips/[id]/actions";

describe("trip cover actions", () => {
  it("uploads and revalidates dashboard and public paths", async () => {
    const file = new File(["x"], "cover.jpg", { type: "image/jpeg" });
    const formData = new FormData();
    formData.set("file", file);
    vi.mocked(getTripById).mockResolvedValueOnce({ id: "trip1", status: "draft" } as never);

    await actions.uploadTripCoverAction("trip1", "slug1", formData);

    expect(uploadTripCoverImage).toHaveBeenCalledWith("trip1", file);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/trips/trip1");
    expect(revalidatePath).toHaveBeenCalledWith("/t/slug1");
  });

  it("removes and revalidates dashboard and public paths", async () => {
    vi.mocked(getTripById).mockResolvedValueOnce({ id: "trip2", status: "draft" } as never);

    await actions.removeTripCoverAction("trip2", "slug2");

    expect(removeTripCoverImage).toHaveBeenCalledWith("trip2");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/trips/trip2");
    expect(revalidatePath).toHaveBeenCalledWith("/t/slug2");
  });
});
