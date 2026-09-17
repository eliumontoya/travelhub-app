import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from "@supabase/ssr";
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
  });

  it("returns the role from the profiles table for an authenticated user", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const mockUser = { id: "user-1" };
    const single = vi.fn().mockResolvedValue({
      data: { role: "agent" },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from,
    };
    vi.mocked(createServerClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServerClient>);

    const request = mockNextRequest();
    const result = await updateSession(request);

    expect(result.user).toEqual(mockUser);
    expect(result.role).toBe("agent");
    expect(from).toHaveBeenCalledWith("profiles");
  });

  it("returns null role when the profile row is missing", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const mockUser = { id: "user-1" };
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from,
    };
    vi.mocked(createServerClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServerClient>);

    const request = mockNextRequest();
    const result = await updateSession(request);

    expect(result.role).toBeNull();
  });

  it("returns null role when the stored role is unknown", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const mockUser = { id: "user-1" };
    const single = vi.fn().mockResolvedValue({
      data: { role: "superuser" },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from,
    };
    vi.mocked(createServerClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServerClient>);

    const request = mockNextRequest();
    const result = await updateSession(request);

    expect(result.role).toBeNull();
  });
});
