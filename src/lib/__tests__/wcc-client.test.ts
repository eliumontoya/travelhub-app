import { beforeEach, describe, expect, it, vi } from "vitest";

const createSupabaseClient = vi.fn();
const createServerClient = vi.fn();

vi.mock("@supabase/supabase-js", () => ({ createClient: createSupabaseClient }));
vi.mock("@/lib/supabase/server", () => ({ createClient: createServerClient }));

describe("createWccClient", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("uses the server-only service role client when configured", async () => {
    const adminClient = { from: vi.fn() };
    createSupabaseClient.mockReturnValue(adminClient);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");

    const { createWccClient } = await import("@/lib/wcc-client");

    await expect(createWccClient()).resolves.toBe(adminClient);
    expect(createSupabaseClient).toHaveBeenCalledWith("https://example.supabase.co", "service-role-key", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("falls back to the authenticated server client without service role", async () => {
    const requestClient = { from: vi.fn() };
    createServerClient.mockResolvedValue(requestClient);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    const { createWccClient } = await import("@/lib/wcc-client");

    await expect(createWccClient()).resolves.toBe(requestClient);
    expect(createServerClient).toHaveBeenCalledOnce();
    expect(createSupabaseClient).not.toHaveBeenCalled();
  });
});
