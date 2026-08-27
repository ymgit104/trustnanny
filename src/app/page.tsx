import { redirect } from "next/navigation";
import { ClearStaleSession } from "@/components/clear-stale-session";
import { getSessionState } from "@/lib/auth";

/**
 * The only place that routes by role. Middleware deliberately does not do this,
 * because it would put a database query on every request; this runs once, on
 * the way in.
 */
export default async function Home() {
  const state = await getSessionState();

  if (state.status === "signed-out") redirect("/login");

  // A valid token with no profile row - the signup trigger never fired, or the
  // account was deleted underneath a live session.
  //
  // Signing out from here would do nothing: server components cannot write
  // cookies, so the token would survive, middleware would keep seeing a valid
  // session, and /login would bounce back here forever. The client component
  // below calls the sign-out server action instead, which can clear it.
  if (state.status === "orphaned") return <ClearStaleSession />;

  redirect(state.profile.role === "caregiver" ? "/caregiver" : "/parent");
}
