import { NextResponse } from "next/server";
import { resetToArmedState } from "@/lib/demo-state.mjs";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * DEMO-02. Re-arms the demo in one click, so a retake never needs a terminal.
 *
 * The only API route in the app besides keep-alive; every other mutation is a
 * server action. It exists because a reset is not something a signed-in user
 * does to their own data - it rewrites the whole community.
 *
 * Gated on ENABLE_DEMO_RESET rather than on a session, deliberately: the point
 * is to recover a demo that may be in any state at all, including signed out.
 * Leave the flag unset anywhere real data could exist - this deletes shifts.
 */
export const dynamic = "force-dynamic";

export async function POST() {
  if (process.env.ENABLE_DEMO_RESET !== "true") {
    return NextResponse.json(
      { ok: false, message: "Demo reset is disabled." },
      { status: 404 },
    );
  }

  try {
    const result = await resetToArmedState(createAdminClient());
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Reset failed.",
      },
      { status: 500 },
    );
  }
}
