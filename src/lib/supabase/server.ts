import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * Session-aware Supabase client for server components and server actions.
 *
 * This client answers exactly one question: who is making this request. It
 * cannot read application data - RLS is on with no policies, so the
 * `authenticated` role sees nothing. Data access goes through the admin client
 * once this one has established identity.
 *
 * `cookies()` is synchronous in Next 14; it only became async in 15, so most
 * current examples online will await it and fail to compile here.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(SUPABASE_URL(), SUPABASE_PUBLISHABLE_KEY(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server components cannot write cookies, and Next throws when they
          // try. Safe to swallow: middleware refreshes the session on every
          // request, so the write here is only ever a nice-to-have.
        }
      },
    },
  });
}
