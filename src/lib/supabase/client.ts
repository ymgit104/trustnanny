import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * Supabase client for client components.
 *
 * Carries only the publishable key, so under RLS-with-no-policies it can read
 * nothing at all. That is deliberate: it exists to hold the session, not to
 * fetch data. Every read goes through a server action.
 */
export function createClient() {
  return createBrowserClient(SUPABASE_URL(), SUPABASE_PUBLISHABLE_KEY());
}
