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
    return <span className="text-xs text-red-700">{error}</span>;
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm text-neutral-600 underline-offset-2 hover:text-red-700 hover:underline"
      >
        Cancel
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-sm">
      <span className="text-neutral-600">Cancel this shift?</span>
      <button
        type="button"
        onClick={handleCancel}
        disabled={pending}
        className="font-medium text-red-700 hover:underline disabled:opacity-50"
      >
        {pending ? "Cancelling…" : "Yes, cancel"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={pending}
        className="text-neutral-600 hover:text-neutral-900 disabled:opacity-50"
      >
        Keep
      </button>
    </span>
  );
}
