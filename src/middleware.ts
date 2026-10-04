import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

function buildUnauthorizedRedirect(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", "unauthorized");
  return NextResponse.redirect(loginUrl);
}

export async function middleware(request: NextRequest) {
  const { response, user, role } = await updateSession(request);

  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");

  if (!isDashboard) {
    return response;
  }

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!role) {
    return buildUnauthorizedRedirect(request);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
