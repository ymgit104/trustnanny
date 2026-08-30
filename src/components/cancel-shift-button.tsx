"use client";

import { useState } from "react";
import { deleteShift } from "@/lib/actions";

/**
 * CRUD-04's confirm step, inline rather than a browser confirm() dialog: it
 * reads better on camera and does not block the page.
 */
export function CancelShiftButton({ shiftId }: { shiftId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setPending(true);
    setError(null);

    const result = await deleteShift(shiftId);

    if (result?.error) {
      setError(result.error);
      setPending(false);
      setConfirming(false);
      return;
    }

    // The action revalidates, so the row re-renders as cancelled on its own.
    setPending(false);
    setConfirming(false);
  }

  if (error) {
    return <span className="font-mono text-xs text-critical">{error}</span>;
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="btn-ghost px-3 py-2 text-xs text-critical hover:border-critical/40 hover:bg-red-50"
      >
        Cancel
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-sm">
      <span className="text-ink-soft">Cancel this shift?</span>
      <button
        type="button"
        onClick={handleCancel}
        disabled={pending}
        className="font-semibold text-critical hover:underline disabled:opacity-50"
      >
        {pending ? "Cancelling…" : "Yes, cancel"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={pending}
        className="text-ink-soft hover:text-ink disabled:opacity-50"
      >
        Keep
      </button>
    </span>
  );
}
