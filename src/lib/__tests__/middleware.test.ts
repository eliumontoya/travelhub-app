import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: vi.fn(),
}));

import { updateSession } from "@/lib/supabase/middleware";
import { middleware } from "@/middleware";

function mockDashboardRequest() {
  return {
    url: "http://localhost/dashboard",
    nextUrl: new URL("http://localhost/dashboard"),
    cookies: {
      get: () => undefined,
      getAll: () => [],
      set: () => {},
    },
  } as unknown as NextRequest;
}

function redirectLocation(response: NextResponse): URL {
  const location = response.headers.get("location");
  expect(location).toBeTruthy();
  return new URL(location as string, "http://localhost");
}

describe("middleware (configured Supabase)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("redirects unauthenticated users to /login with redirectTo=/dashboard", async () => {
    vi.mocked(updateSession).mockResolvedValue({
      response: NextResponse.next(),
      user: null,
      role: null,
    });

    const result = await middleware(mockDashboardRequest());

    expect(result.status).toBe(307);
    const url = redirectLocation(result);
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("redirectTo")).toBe("/dashboard");
  });

  it("redirects authenticated users without a role to /login with error=unauthorized", async () => {
    vi.mocked(updateSession).mockResolvedValue({
      response: NextResponse.next(),
      user: { id: "user-1" } as never,
      role: null,
    });

    const result = await middleware(mockDashboardRequest());

    expect(result.status).toBe(307);
    const url = redirectLocation(result);
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("error")).toBe("unauthorized");
  });

  it("passes through for an admin user", async () => {
    const response = NextResponse.next();
    vi.mocked(updateSession).mockResolvedValue({
      response,
      user: { id: "user-1" } as never,
      role: "admin",
    });

    const result = await middleware(mockDashboardRequest());

    expect(result).toBe(response);
  });
});
