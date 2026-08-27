// Importing this module from a client component is a BUILD ERROR, not a code
// review note. The service-role key bypasses RLS entirely, and RLS here has no
// policies, so this key is the only thing that can read the tables - shipping
// it to a browser would expose every family's data.
import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireEnv, SUPABASE_URL } from "@/lib/env";

/**
 * Service-role Supabase client. Bypasses RLS, so every caller must have
 * already resolved and role-checked the session before using it.
 *
 * Built per call rather than at module scope so that a missing environment
 * variable surfaces when a request runs, not while Next is statically
 * analysing modules at build time.
 */
export function createAdminClient() {
  return createSupabaseClient(
    SUPABASE_URL(),
    requireEnv(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    {
      // This client is never a signed-in user, so the session machinery is
      // wrong for it: nothing to persist, nothing to refresh.
      auth: { persistSession: false, autoRefreshToken: false },

      // Opt every query out of Next's fetch cache and React's per-request
      // memoisation. Supabase queries are GETs, so two identical reads in one
      // request are otherwise deduplicated and the second silently replays the
      // first's response. That is wrong for a database: dispatch reads
      // availability, a caregiver's state changes, and the re-read returns the
      // stale row. Caught this exact failure - a caregiver marked unavailable
      // was still being offered shifts.
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
    },
  );
}
