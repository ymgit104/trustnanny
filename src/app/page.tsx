import { redirect } from "next/navigation";
import { getSessionState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * The only place that routes by role. Middleware deliberately does not do this,
 * because it would put a database query on every request; this runs once, on
 * the way in.
 */
export default async function Home() {
  const state = await getSessionState();

  if (state.status === "signed-out") redirect("/login");

  // A valid auth user with no profile row means the signup trigger did not
  // fire. Signing the session out is the only way to break the loop: middleware
  // would otherwise keep sending them here, and every page that reads a profile
  // would crash. Better a clean trip back to /login than a broken account.
  if (state.status === "orphaned") {
    const supabase = createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  redirect(state.profile.role === "caregiver" ? "/caregiver" : "/parent");
}
