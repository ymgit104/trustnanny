"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const ACCOUNTS = [
  { label: "Parent", email: "priya@example.com" },
  { label: "Known", email: "meera@example.com" },
  { label: "No-show", email: "lakshmi@example.com" },
  { label: "New", email: "anjali@example.com" },
];

/**
 * DEMO-02 and DEMO-04 in one strip: the credentials are on screen so they never
 * have to be read from a script, and the reset is one click so a retake never
 * needs a terminal.
 *
 * Rendered only when the server says ENABLE_DEMO_RESET is on, so it cannot
 * appear in a deployment where the flag is unset.
 */
export function DemoBar() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function reset() {
    setPending(true);
    setMessage(null);

    try {
      const response = await fetch("/api/demo", { method: "POST" });
      const body = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };
      setMessage(body.message ?? (response.ok ? "Reset." : "Reset failed."));
      // The reset rewrites the shift this page is rendering, so pull it again
      // rather than leaving the old one on screen.
      router.refresh();
    } catch {
      setMessage("Couldn't reach the reset route.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-trust/30 bg-trust-tint p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label-caps text-trust">Demo controls</span>
        <button
          type="button"
          onClick={reset}
          disabled={pending}
          className="btn-primary px-3 py-1.5 text-xs"
        >
          {pending ? "Resetting…" : "Reset demo"}
        </button>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-ink-soft">
        {ACCOUNTS.map((account) => (
          <li key={account.email}>
            <span className="text-ink-faint">{account.label} </span>
            <span className="font-mono">{account.email}</span>
          </li>
        ))}
        <li>
          <span className="text-ink-faint">Password </span>
          <span className="font-mono">demo1234</span>
        </li>
      </ul>

      {message && <p className="text-ink-soft">{message}</p>}
    </div>
  );
}
