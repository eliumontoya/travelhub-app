import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => false,
  createClient: vi.fn(),
}));

import { createClient, createSupplier, createItem, createTripDay } from "@/lib/data";

describe("note writes are sanitized (mock mode)", () => {
  it("createClient strips <script> from notes", async () => {
    const client = await createClient({
      name: "Cliente XSS",
      notes: "<p>ok</p><script>alert(1)</script>",
    });
    expect(client.notes).not.toContain("<script");
    expect(client.notes).toContain("ok");
  });

  it("createSupplier strips <script> from notes", async () => {
    const supplier = await createSupplier({
      name: "Proveedor XSS",
      type: "actividad",
      notes: "<script>alert(1)</script><strong>ok</strong>",
    });
    expect(supplier.notes).not.toContain("<script");
    expect(supplier.notes).toContain("ok");
  });

  it("createItem strips <script> from notes", async () => {
    const day = await createTripDay({ tripId: "trip-xss", date: "2030-01-01" });
    const item = await createItem({
      tripDayId: day.id,
      type: "note",
      title: "Item XSS",
      notes: "<script>alert(1)</script>",
    });
    expect(item.notes).not.toContain("<script");
  });
});
