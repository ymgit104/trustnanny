import type { NextRequest } from "next/server";
import {
  redirectKeepingSession,
  updateSession,
} from "@/lib/supabase/middleware";

/**
 * AUTH-05. Signed-out users go to /login, signed-in users are kept off it.
 *
 * Deliberately does not look up the caller's role: that is a database query,
 * and this runs on every request. `/` does it once and routes from there.
 */
export async function middleware(request: NextRequest) {
  const { response, claims } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (!claims && pathname !== "/login") {
    return redirectKeepingSession(request, response, "/login");
  }

  if (claims && pathname === "/login") {
    return redirectKeepingSession(request, response, "/");
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and images, which never need a session.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
