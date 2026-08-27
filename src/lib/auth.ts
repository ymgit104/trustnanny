import "server-only";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/lib/types";

/**
 * `orphaned` is a real state, not a defensive nicety: an auth user with no
 * profile row is exactly the account that signs in successfully and then
 * crashes every page that reads a profile. Naming it here means callers have
 * to decide what to do about it.
 */
export type SessionState =
  | { status: "signed-out" }
  | { status: "orphaned"; userId: string }
  | { status: "ok"; profile: Profile };

export async function getSessionState(): Promise<SessionState> {
  const supabase = createClient();
  const { data } = await supabase.auth.getClaims();

  const userId = data?.claims?.sub;
  if (!userId) return { status: "signed-out" };

  // The session client cannot read profiles - RLS is on with no policies - so
  // identity comes from the token and the row comes from the admin client.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle<Profile>();

  if (!profile) return { status: "orphaned", userId };
  return { status: "ok", profile };
}

/**
 * Guards a page or action. Redirects rather than throwing, so a caregiver who
 * types /parent lands somewhere sensible instead of on an error.
 */
export async function requireRole(role: Role): Promise<Profile> {
  const state = await getSessionState();

  if (state.status === "signed-out") redirect("/login");
  if (state.status === "orphaned") redirect("/");
  if (state.profile.role !== role) redirect("/");

  return state.profile;
}
