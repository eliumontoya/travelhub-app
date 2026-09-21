import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSupabaseAdmin = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin,
}));

import { DOCUMENTS_BUCKET, getSignedServiceDocumentDownloadUrl, getSignedServiceDocumentUploadUrl } from "@/lib/data/documents";

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

interface CreateSignedUploadUrlCall {
  path: string;
  options: { upsert: boolean } | undefined;
}

function buildAdminUploadMock(overrides: { error?: unknown; signedUrl?: string } = {}) {
  const calls: CreateSignedUploadUrlCall[] = [];
  const createSignedUploadUrl = vi.fn((path: string, options?: { upsert: boolean }) => {
    calls.push({ path, options });
    if (overrides.error) {
      return Promise.resolve({ data: null, error: overrides.error });
    }
    return Promise.resolve({
      data: {
        signedUrl: overrides.signedUrl ?? `https://signed.test/upload/${path}`,
        path,
        token: "test-token",
      },
      error: null,
    });
  });
  const from = vi.fn(() => ({ createSignedUploadUrl }));
  const storage = { from };
  getSupabaseAdmin.mockReturnValue({
    storage,
    from,
  } as unknown as ReturnType<typeof getSupabaseAdmin>);
  return { calls, createSignedUploadUrl, from };
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

describe("getSignedServiceDocumentUploadUrl", () => {
  it("is exported from the documents module", () => {
    // Existence check — RED when the export is missing.
    expect(typeof getSignedServiceDocumentUploadUrl).toBe("function");
  });

  it("returns the signed PUT URL returned by createSignedUploadUrl", async () => {
    const { calls, from } = buildAdminUploadMock();

    const url = await getSignedServiceDocumentUploadUrl("trips/trip-1/doc.pdf");

    expect(url).toBe("https://signed.test/upload/trips/trip-1/doc.pdf");
    expect(from).toHaveBeenCalledWith(DOCUMENTS_BUCKET);
    // Path is passed unchanged; storage-js does not accept expiresIn here.
    expect(calls).toEqual([
      { path: "trips/trip-1/doc.pdf", options: { upsert: false } },
    ]);
  });

  it("rethrows storage errors so the MCP layer can sanitize them", async () => {
    buildAdminUploadMock({ error: new Error("storage offline") });

    await expect(
      getSignedServiceDocumentUploadUrl("trips/trip-1/doc.pdf")
    ).rejects.toThrow("storage offline");
  });

  it("does not read or echo the SUPABASE_SERVICE_ROLE_KEY env var into the result", async () => {
    // The helper MUST delegate entirely to getSupabaseAdmin().storage and
    // never read process.env.SUPABASE_SERVICE_ROLE_KEY directly. We set the
    // env var to a sentinel value; if the helper ever echoed it (e.g. via a
    // process.env lookup in the result path) the assertion would fail.
    const sentinel = "service-role.SECRET-LEAK-CHECK";
    const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = sentinel;
    try {
      // Storage mock returns a clean URL with no env-derived text.
      buildAdminUploadMock({ signedUrl: "https://signed.test/upload/doc.pdf" });
      const url = await getSignedServiceDocumentUploadUrl("doc.pdf");
      expect(url).toBe("https://signed.test/upload/doc.pdf");
      expect(url).not.toContain(sentinel);
      expect(getSupabaseAdmin).toHaveBeenCalledTimes(1);
    } finally {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    }
  });

  it("uses getSupabaseAdmin (service role) and not the cookie-bound client", async () => {
    const { from } = buildAdminUploadMock();

    await getSignedServiceDocumentUploadUrl("any/path.pdf");

    expect(getSupabaseAdmin).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("trip-documents");
  });
});