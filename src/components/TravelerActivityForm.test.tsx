import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/t/[slug]/actions", () => ({
  createTravelerActivityAction: vi.fn(async () => ({ status: "idle" })),
  updateTravelerActivityAction: vi.fn(async () => ({ status: "idle" })),
  deleteTravelerActivityAction: vi.fn(async () => ({ status: "idle" })),
}));

import {
  isTravelerActivitySubmitShortcut,
  TravelerActivityForm,
} from "./TravelerActivityForm";

describe("TravelerActivityForm", () => {
  it("renders an accessible add form and owner edit controls", () => {
    const addMarkup = renderToStaticMarkup(
      <TravelerActivityForm tripId="trip-1" tripDayId="day-1" slug="paris-2026" />
    );
    const editMarkup = renderToStaticMarkup(
      <TravelerActivityForm
        tripId="trip-1"
        tripDayId="day-1"
        slug="paris-2026"
        item={{ id: "item-1", title: "Museo", startTime: "09:30", location: "Centro", notes: "Llegar antes" }}
      />
    );

    expect(addMarkup).toContain("Agregar una actividad");
    expect(addMarkup).toContain('name="title"');
    expect(addMarkup).toContain('name="notes"');
    expect(editMarkup).toContain("Editar actividad");
    expect(editMarkup).toContain("Eliminar");
  });

  it("recognizes Ctrl or Command Enter as the keyboard submit shortcut", () => {
    expect(isTravelerActivitySubmitShortcut({ key: "Enter", ctrlKey: true, metaKey: false })).toBe(true);
    expect(isTravelerActivitySubmitShortcut({ key: "Enter", ctrlKey: false, metaKey: true })).toBe(true);
    expect(isTravelerActivitySubmitShortcut({ key: "Enter", ctrlKey: false, metaKey: false })).toBe(false);
    expect(isTravelerActivitySubmitShortcut({ key: "Escape", ctrlKey: true, metaKey: false })).toBe(false);
  });
});
