import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Keeps the Supabase project awake.
 *
 * Free Supabase projects pause after a week of inactivity, and a paused project
 * does not wake up when someone visits - it has to be restored by hand from the
 * dashboard. For a submitted assignment that means a grader opening the link a
 * week later finds a dead app. This is the cheapest insurance against that.
 *
 * The query has to genuinely reach Postgres. A cached response, or a route that
 * only returns a timestamp, resets nothing - Supabase counts database activity,
 * not HTTP traffic. Hence force-dynamic, no-store on the way out, and a real
 * head-only count against a table.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = {
  "Cache-Control": "no-store, max-age=0, must-revalidate",
} as const;

export async function GET() {
  try {
    const admin = createAdminClient();

    // head: true asks for the count and no rows, so this is about as small as a
    // real query gets while still being a real query.
    const { count, error } = await admin
      .from("profiles")
      .select("*", { count: "exact", head: true });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message, at: new Date().toISOString() },
        { status: 500, headers: NO_STORE },
      );
    }

    return NextResponse.json(
      { ok: true, at: new Date().toISOString(), profiles: count ?? 0 },
      { status: 200, headers: NO_STORE },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
        at: new Date().toISOString(),
      },
      { status: 500, headers: NO_STORE },
    );
  }
}
