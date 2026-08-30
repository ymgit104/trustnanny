"use client";

import { useEffect, useRef } from "react";
import { signOut } from "@/lib/actions";

/**
 * Breaks the lock-out for a session whose profile row is gone.
 *
 * The obvious fix - calling signOut() from the server component - silently does
 * nothing: server components cannot write cookies, so the auth cookie survives,
 * middleware still sees a valid token, and the redirect to /login bounces
 * straight back to /. That is an unbreakable loop, and the account can never
 * reach the login page again.
 *
 * Server actions can write cookies, so the sign-out has to be triggered from
 * the client. Rendered only on the orphaned path.
 */
export function ClearStaleSession() {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    void signOut();
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-2 px-4">
      <h1 className="text-lg font-bold text-ink">Signing you out</h1>
      <p className="text-sm text-ink-soft">
        This account is no longer set up. Taking you back to sign in.
      </p>
    </main>
  );
}
