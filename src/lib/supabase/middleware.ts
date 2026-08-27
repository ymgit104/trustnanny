import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";

/** Headers Supabase asks us to copy onto any response that sets auth cookies. */
const CACHE_HEADERS = ["cache-control", "expires", "pragma"];

/**
 * Refreshes the auth token and reports who the caller is.
 *
 * Server components cannot write cookies, so a refreshed token has to be
 * written here or the session silently expires mid-visit.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    SUPABASE_URL(),
    SUPABASE_PUBLISHABLE_KEY(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          // Write to the request too, so anything downstream in this same pass
          // sees the refreshed token rather than the stale one.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          // Responses that set auth cookies must not be cached by a CDN, or one
          // user's session token gets served to the next visitor.
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // getClaims verifies the JWT signature locally rather than calling the auth
  // server, which matters when it runs on every single request.
  const { data } = await supabase.auth.getClaims();

  return { response, claims: data?.claims ?? null };
}

/**
 * Redirects while keeping whatever `updateSession` just wrote.
 *
 * A bare `NextResponse.redirect(url)` drops the refreshed cookies, so the next
 * request looks signed out, redirects again, and the user bounces between
 * /login and / forever. Every redirect in middleware must go through here.
 */
export function redirectKeepingSession(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";

  const redirect = NextResponse.redirect(url);

  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  CACHE_HEADERS.forEach((header) => {
    const value = response.headers.get(header);
    if (value) redirect.headers.set(header, value);
  });

  return redirect;
}
