import { describe, it, expect, vi } from "vitest";
import { getClientById, getSignedDocumentUploadUrl } from "@/lib/data";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => false,
  createClient: vi.fn(),
}));

describe("data layer MCP injection", () => {
  it("does not fall back to mock data when a supabase client is injected", async () => {
    const fromMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    const injectedClient = {
      from: fromMock,
    } as unknown as Parameters<typeof getClientById>[1];

    const result = await getClientById("any-id", injectedClient);

    expect(fromMock).toHaveBeenCalledWith("clients");
    expect(result).toBeNull();
  });

  it("returns a signed upload URL from storage", async () => {
    const createSignedUploadUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://example.com/upload?token=abc" },
      error: null,
    });
    const client = {
      storage: {
        from: vi.fn().mockReturnValue({ createSignedUploadUrl }),
      },
    } as unknown as Parameters<typeof getSignedDocumentUploadUrl>[2];

    const url = await getSignedDocumentUploadUrl("trips/t1/doc.pdf", 300, client);

    expect(url).toBe("https://example.com/upload?token=abc");
    expect(createSignedUploadUrl).toHaveBeenCalledWith("trips/t1/doc.pdf", {
      upsert: false,
    });
  });

  it("returns null for signed upload URL when storage fails", async () => {
    const client = {
      storage: {
        from: vi.fn().mockReturnValue({
          createSignedUploadUrl: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "storage error" },
          }),
        }),
      },
    } as unknown as Parameters<typeof getSignedDocumentUploadUrl>[2];

    const url = await getSignedDocumentUploadUrl("trips/t1/doc.pdf", 300, client);
    expect(url).toBeNull();
  });
});
