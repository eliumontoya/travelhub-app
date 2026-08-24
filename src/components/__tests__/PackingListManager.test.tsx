import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PackingListManager } from "@/components/PackingListManager";
import type { PackingItem } from "@/types";

const items: PackingItem[] = [
  { id: "p1", tripId: "t1", label: "Pasaporte", checked: false, sortOrder: 0 },
  { id: "p2", tripId: "t1", label: "Protector solar", checked: true, sortOrder: 1 },
];

describe("PackingListManager", () => {
  it("renders item labels in read-only mode without add/delete controls", () => {
    const html = renderToStaticMarkup(
      <PackingListManager items={items} readOnly title="Checklist de equipaje" />
    );

    expect(html).toContain("Pasaporte");
    expect(html).toContain("Protector solar");
    expect(html).toContain("Checklist de equipaje");
    expect(html).not.toContain("Agregar item");
    expect(html).not.toContain("Eliminar");
  });

  it("renders the add input in edit (non-read-only) mode", () => {
    const html = renderToStaticMarkup(
      <PackingListManager
        items={items}
        onAdd={async () => {}}
        onToggle={async () => {}}
        onDelete={async () => {}}
      />
    );

    expect(html).toContain("Agregar item");
    expect(html).toContain("Eliminar");
  });

  it("renders nothing in read-only mode when there are no items", () => {
    const html = renderToStaticMarkup(<PackingListManager items={[]} readOnly />);
    expect(html).toBe("");
  });
});
