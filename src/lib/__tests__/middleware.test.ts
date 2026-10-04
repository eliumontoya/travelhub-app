import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: vi.fn(),
}));

import { updateSession } from "@/lib/supabase/middleware";
import { middleware } from "@/middleware";

function mockRequest(path: string) {
  return {
    url: `http://localhost${path}`,
    nextUrl: new URL(`http://localhost${path}`),
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

describe("middleware (Supabase session gate)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("redirects unauthenticated users to /login with redirectTo=/dashboard", async () => {
    vi.mocked(updateSession).mockResolvedValue({
      response: NextResponse.next(),
      user: null,
      role: null,
    });

    const result = await middleware(mockRequest("/dashboard"));

    expect(result.status).toBe(307);
    const url = redirectLocation(result);
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("redirectTo")).toBe("/dashboard");
  });

  it("preserves the requested dashboard path in redirectTo", async () => {
    vi.mocked(updateSession).mockResolvedValue({
      response: NextResponse.next(),
      user: null,
      role: null,
    });

    const result = await middleware(mockRequest("/dashboard/trips/new"));

    const url = redirectLocation(result);
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("redirectTo")).toBe("/dashboard/trips/new");
  });

  it("redirects authenticated users without a role to /login with error=unauthorized", async () => {
    vi.mocked(updateSession).mockResolvedValue({
      response: NextResponse.next(),
      user: { id: "user-1" } as never,
      role: null,
    });

    const result = await middleware(mockRequest("/dashboard"));

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

    const result = await middleware(mockRequest("/dashboard"));

    expect(result).toBe(response);
  });

  it("passes through for an agent user", async () => {
    const response = NextResponse.next();
    vi.mocked(updateSession).mockResolvedValue({
      response,
      user: { id: "user-2" } as never,
      role: "agent",
    });

    const result = await middleware(mockRequest("/dashboard"));

    expect(result).toBe(response);
  });

  it("passes public non-dashboard routes through even without a session", async () => {
    const response = NextResponse.next();
    vi.mocked(updateSession).mockResolvedValue({
      response,
      user: null,
      role: null,
    });

    const result = await middleware(mockRequest("/t/italia-perez-2026"));

    expect(result).toBe(response);
  });
});
