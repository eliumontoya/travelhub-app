import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/client-auth", () => ({
  getClientSession: vi.fn(),
}));

vi.mock("@/lib/data", () => ({
  createTravelerActivity: vi.fn(),
  updateTravelerActivity: vi.fn(),
  deleteTravelerActivity: vi.fn(),
  createTripFeedback: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { getClientSession } from "@/lib/client-auth";
import {
  createTravelerActivity,
  deleteTravelerActivity,
  updateTravelerActivity,
} from "@/lib/data";
import {
  createTravelerActivityAction,
  deleteTravelerActivityAction,
  updateTravelerActivityAction,
} from "./actions";

const initialTravelerActivityActionState = { status: "idle" } as const;

function activityFormData(entries: Record<string, string> = {}) {
  const formData = new FormData();
  for (const [key, value] of Object.entries({
    title: "Visitar el museo",
    startTime: "09:30",
    location: "Centro histórico",
    notes: "Llegar 10 minutos antes",
    ...entries,
  })) {
    formData.set(key, value);
  }
  return formData;
}

describe("traveler activity actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getClientSession).mockResolvedValue({ clientId: "c1", expiresAt: Date.now() + 60_000 });
  });

  it("derives the client from the session and revalidates after a valid create", async () => {
    vi.mocked(createTravelerActivity).mockResolvedValue({
      ok: true,
      item: { id: "item-1" },
    } as never);

    const result = await createTravelerActivityAction(
      "trip-1",
      "day-1",
      "paris-2026",
      initialTravelerActivityActionState,
      activityFormData({ clientId: "other-client" })
    );

    expect(result).toEqual({ status: "success", message: "Actividad agregada." });
    expect(createTravelerActivity).toHaveBeenCalledWith({
      tripId: "trip-1",
      tripDayId: "day-1",
      clientId: "c1",
      title: "Visitar el museo",
      startTime: "09:30",
      location: "Centro histórico",
      notes: "Llegar 10 minutos antes",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/t/paris-2026");
  });

  it("rejects a missing session and invalid fields before reaching the data layer", async () => {
    vi.mocked(getClientSession).mockResolvedValue(null);

    await expect(
      createTravelerActivityAction(
        "trip-1",
        "day-1",
        "paris-2026",
        initialTravelerActivityActionState,
        activityFormData()
      )
    ).resolves.toEqual({ status: "error", message: "Iniciá sesión para modificar actividades." });
    expect(createTravelerActivity).not.toHaveBeenCalled();

    vi.mocked(getClientSession).mockResolvedValue({ clientId: "c1", expiresAt: Date.now() + 60_000 });
    await expect(
      createTravelerActivityAction(
        "trip-1",
        "day-1",
        "paris-2026",
        initialTravelerActivityActionState,
        activityFormData({ title: "", startTime: "25:00" })
      )
    ).resolves.toEqual({ status: "error", message: "Revisá los datos de la actividad." });
    expect(createTravelerActivity).not.toHaveBeenCalled();
  });

  it("updates and deletes only through the session-derived client identity", async () => {
    vi.mocked(updateTravelerActivity).mockResolvedValue({ ok: true, item: { id: "item-1" } } as never);
    vi.mocked(deleteTravelerActivity).mockResolvedValue({ ok: true });

    await expect(
      updateTravelerActivityAction(
        "trip-1",
        "day-1",
        "item-1",
        "paris-2026",
        initialTravelerActivityActionState,
        activityFormData({ title: "Cena en el barrio latino" })
      )
    ).resolves.toEqual({ status: "success", message: "Actividad actualizada." });
    await expect(
      deleteTravelerActivityAction(
        "trip-1",
        "day-1",
        "item-1",
        "paris-2026",
        initialTravelerActivityActionState,
        new FormData()
      )
    ).resolves.toEqual({ status: "success", message: "Actividad eliminada." });

    expect(updateTravelerActivity).toHaveBeenCalledWith(expect.objectContaining({ clientId: "c1", itemId: "item-1" }));
    expect(deleteTravelerActivity).toHaveBeenCalledWith({
      tripId: "trip-1",
      tripDayId: "day-1",
      clientId: "c1",
      itemId: "item-1",
    });
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });

  it("does not revalidate when the data layer rejects an update or delete", async () => {
    vi.mocked(updateTravelerActivity).mockResolvedValue({ ok: false, reason: "unauthorized" });
    vi.mocked(deleteTravelerActivity).mockResolvedValue({ ok: false, reason: "unauthorized" });

    await expect(
      updateTravelerActivityAction(
        "trip-1",
        "day-1",
        "other-client-item",
        "paris-2026",
        initialTravelerActivityActionState,
        activityFormData()
      )
    ).resolves.toEqual({ status: "error", message: "No tenés permisos para modificar esta actividad." });
    await expect(
      deleteTravelerActivityAction(
        "trip-1",
        "day-1",
        "other-client-item",
        "paris-2026",
        initialTravelerActivityActionState,
        new FormData()
      )
    ).resolves.toEqual({ status: "error", message: "No tenés permisos para modificar esta actividad." });

    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
