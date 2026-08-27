"use client";

import Link from "next/link";
import { useState } from "react";
import { createShift, updateShift } from "@/lib/actions";
import { formatTime } from "@/lib/format";
import type { CaregiverOption, Shift } from "@/lib/types";

/**
 * CRUD-01 and CRUD-03 share this component. Which one runs is decided by
 * whether an existing shift was passed in, so there is one set of fields and
 * one set of validation messages to keep right.
 */
export function ShiftForm({
  caregivers,
  shift,
}: {
  caregivers: CaregiverOption[];
  shift?: Shift;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isEdit = shift !== undefined;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const result = isEdit
      ? await updateShift(shift.id, formData)
      : await createShift(formData);

    // On success the action redirects, so this only runs on failure.
    if (result?.error) {
      setError(result.error);
      setPending(false);
    }
  }

  if (caregivers.length === 0) {
    return (
      <p className="rounded-lg border border-neutral-200 p-4 text-sm text-neutral-600">
        No caregivers are available in your community right now, so there is
        nobody to schedule. Try again once one is back on.
      </p>
    );
  }

  return (
    // method="post" so a pre-hydration submit does not put the form contents
    // into the URL and browser history.
    <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Date" htmlFor="shift_date">
        <input
          id="shift_date"
          name="shift_date"
          type="date"
          required
          defaultValue={shift?.shift_date}
          className={`${inputClass} font-mono tabular-nums`}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Starts" htmlFor="start_time">
          <input
            id="start_time"
            name="start_time"
            type="time"
            required
            defaultValue={shift ? formatTime(shift.start_time) : "09:00"}
            className={`${inputClass} font-mono tabular-nums`}
          />
        </Field>
        <Field label="Ends" htmlFor="end_time">
          <input
            id="end_time"
            name="end_time"
            type="time"
            required
            defaultValue={shift ? formatTime(shift.end_time) : "17:00"}
            className={`${inputClass} font-mono tabular-nums`}
          />
        </Field>
      </div>

      <Field label="Caregiver" htmlFor="caregiver_id">
        <select
          id="caregiver_id"
          name="caregiver_id"
          required
          defaultValue={shift?.caregiver_id ?? ""}
          className={inputClass}
        >
          <option value="" disabled>
            Choose a caregiver
          </option>
          {caregivers.map((caregiver) => (
            <option key={caregiver.id} value={caregiver.id}>
              {caregiver.full_name}
              {caregiver.level !== null ? ` — level ${caregiver.level}` : ""}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Notes"
        htmlFor="notes"
        hint="Anything a replacement would need to know."
      >
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={shift?.notes ?? ""}
          className={inputClass}
        />
      </Field>

      {error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
        >
          {pending
            ? "Saving…"
            : isEdit
              ? "Save changes"
              : "Schedule shift"}
        </button>
        <Link
          href="/parent/shifts"
          className="text-sm text-neutral-600 hover:text-neutral-900"
        >
          Back to shifts
        </Link>
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900";

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}
