import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSupabaseAdmin = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin,
}));

import { DOCUMENTS_BUCKET, getSignedServiceDocumentDownloadUrl } from "@/lib/data/documents";

interface CreateSignedUrlCall {
  path: string;
  expiresIn: number;
}

function buildAdminMock(overrides: { error?: unknown; signedUrl?: string } = {}) {
  const calls: CreateSignedUrlCall[] = [];
  const createSignedUrl = vi.fn((path: string, expiresIn: number) => {
    calls.push({ path, expiresIn });
    if (overrides.error) {
      return Promise.resolve({ data: null, error: overrides.error });
    }
    return Promise.resolve({
      data: { signedUrl: overrides.signedUrl ?? `https://signed.test/${path}` },
      error: null,
    });
  });
  const from = vi.fn(() => ({ createSignedUrl }));
  const storage = { from };
  getSupabaseAdmin.mockReturnValue({
    storage,
    from,
  } as unknown as ReturnType<typeof getSupabaseAdmin>);
  return { calls, createSignedUrl, from };
}

beforeEach(() => {
  getSupabaseAdmin.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getSignedServiceDocumentDownloadUrl", () => {
  it("signs the path against the trip-documents bucket with a default 3600 expiry", async () => {
    const { calls, from } = buildAdminMock();

    const url = await getSignedServiceDocumentDownloadUrl("services/svc-1/item/a.pdf");

    expect(url).toBe("https://signed.test/services/svc-1/item/a.pdf");
    expect(from).toHaveBeenCalledWith(DOCUMENTS_BUCKET);
    expect(calls).toEqual([{ path: "services/svc-1/item/a.pdf", expiresIn: 3600 }]);
  });

  it("honors an explicit expiresIn override", async () => {
    const { calls } = buildAdminMock();

    await getSignedServiceDocumentDownloadUrl("path/to/file.pdf", 120);

    expect(calls).toEqual([{ path: "path/to/file.pdf", expiresIn: 120 }]);
  });

  it("rethrows the storage error so the caller can map it to a sanitized result", async () => {
    buildAdminMock({ error: new Error("storage offline") });

    await expect(
      getSignedServiceDocumentDownloadUrl("path/to/file.pdf")
    ).rejects.toThrow("storage offline");
  });

  it("uses getSupabaseAdmin (service role) and not the cookie-bound client", async () => {
    const { from } = buildAdminMock();

    await getSignedServiceDocumentDownloadUrl("any/path.pdf");

    expect(getSupabaseAdmin).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("trip-documents");
  });
});