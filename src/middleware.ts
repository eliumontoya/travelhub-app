import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { currentMockAccountId, mockProfiles } from "@/lib/mock-data";
import type { AccountRole } from "@/types";

const MOCK_ACCOUNT_COOKIE = "x-mock-account-id";

function resolveMockRole(request: NextRequest): AccountRole | null {
  const accountId = request.cookies.get(MOCK_ACCOUNT_COOKIE)?.value ?? currentMockAccountId;
  const profile = mockProfiles[accountId];
  if (profile?.role === "admin" || profile?.role === "agent") {
    return profile.role;
  }
  return null;
}

function buildUnauthorizedRedirect(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", "unauthorized");
  return NextResponse.redirect(loginUrl);
}

export async function middleware(request: NextRequest) {
  const { response, user, role: supabaseRole } = await updateSession(request);

  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");

  // Sin Supabase configurado no hay forma de autenticar; se deja pasar para
  // que el dev siga viendo la app con datos mock (ver src/lib/data.ts).
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  if (!isDashboard) {
    return response;
  }

  if (supabaseConfigured) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (!supabaseRole) {
      return buildUnauthorizedRedirect(request);
    }
  } else {
    // Mock mode: enforce the same role model using the test/dev cookie override
    // or the default mock account.
    if (!resolveMockRole(request)) {
      return buildUnauthorizedRedirect(request);
    }
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
