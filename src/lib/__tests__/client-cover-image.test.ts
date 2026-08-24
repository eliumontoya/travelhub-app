import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => false,
  createClient: vi.fn(),
}));

import {
  createClient,
  updateClient,
  removeClientCoverImage,
  getClientById,
} from "@/lib/data";

describe("client cover image (mock mode)", () => {
  it("persists the cover image URL", async () => {
    const client = await createClient({ name: "Cliente Cover" });
    const updated = await updateClient(client.id, {
      coverImageUrl: "https://example.com/covers/c.jpg",
    });
    expect(updated.coverImageUrl).toBe("https://example.com/covers/c.jpg");

    const fetched = await getClientById(client.id);
    expect(fetched!.coverImageUrl).toBe("https://example.com/covers/c.jpg");
  });

  it("clears the cover image URL on remove", async () => {
    const client = await createClient({ name: "Cliente Cover 2" });
    await updateClient(client.id, { coverImageUrl: "https://example.com/covers/c.jpg" });

    await removeClientCoverImage(client.id);

    const after = await getClientById(client.id);
    expect(after!.coverImageUrl).toBeUndefined();
  });
});
