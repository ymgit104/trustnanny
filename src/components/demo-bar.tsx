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
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-neutral-700">Demo</span>
        <button
          type="button"
          onClick={reset}
          disabled={pending}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
        >
          {pending ? "Resetting…" : "Reset demo"}
        </button>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-neutral-600">
        {ACCOUNTS.map((account) => (
          <li key={account.email}>
            <span className="text-neutral-500">{account.label} </span>
            <span className="font-mono">{account.email}</span>
          </li>
        ))}
        <li>
          <span className="text-neutral-500">Password </span>
          <span className="font-mono">demo1234</span>
        </li>
      </ul>

      {message && <p className="text-neutral-700">{message}</p>}
    </div>
  );
}
