import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/auth/profile", () => ({
  resolveAccountProfile: vi.fn(),
}));

import { createServerClient } from "@supabase/ssr";
import { resolveAccountProfile } from "@/lib/auth/profile";
import { updateSession } from "@/lib/supabase/middleware";

function mockNextRequest(cookies: { name: string; value: string }[] = []) {
  return {
    cookies: {
      getAll: () => cookies,
      set: () => {},
    },
    url: "http://localhost/dashboard",
    nextUrl: new URL("http://localhost/dashboard"),
  } as unknown as import("next/server").NextRequest;
}

function mockSupabaseClient(user: { id: string } | null) {
  const from = vi.fn();
  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from,
  };
  vi.mocked(createServerClient).mockReturnValue(
    supabase as unknown as ReturnType<typeof createServerClient>
  );
  return { supabase, from };
}

describe("updateSession", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it("returns null role when Supabase is not configured", async () => {
    const request = mockNextRequest();
    const result = await updateSession(request);

    expect(result.user).toBeNull();
    expect(result.role).toBeNull();
    expect(resolveAccountProfile).not.toHaveBeenCalled();
  });

  it("resolves the role through the shared resolver for an authenticated user", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const mockUser = { id: "user-1" };
    const { supabase, from } = mockSupabaseClient(mockUser);
    vi.mocked(resolveAccountProfile).mockResolvedValue({
      id: "user-1",
      role: "agent",
      features: [],
    });

    const request = mockNextRequest();
    const result = await updateSession(request);

    expect(resolveAccountProfile).toHaveBeenCalledWith(supabase, "user-1");
    // The resolver owns the profiles query: the middleware must not duplicate it.
    expect(from).not.toHaveBeenCalled();
    expect(result).toEqual({ response: expect.anything(), user: mockUser, role: "agent" });
  });

  it("returns null role when the resolver finds no account", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const mockUser = { id: "user-1" };
    mockSupabaseClient(mockUser);
    vi.mocked(resolveAccountProfile).mockResolvedValue(null);

    const request = mockNextRequest();
    const result = await updateSession(request);

    expect(resolveAccountProfile).toHaveBeenCalledWith(expect.anything(), "user-1");
    expect(result.role).toBeNull();
  });

  it("returns null role without resolving when there is no session", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    mockSupabaseClient(null);

    const request = mockNextRequest();
    const result = await updateSession(request);

    expect(resolveAccountProfile).not.toHaveBeenCalled();
    expect(result.user).toBeNull();
    expect(result.role).toBeNull();
  });
});
