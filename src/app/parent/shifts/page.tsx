import Link from "next/link";
import { CancelShiftButton } from "@/components/cancel-shift-button";
import { requireRole } from "@/lib/auth";
import {
  formatShiftDate,
  formatTimeRange,
  statusClass,
  statusLabel,
} from "@/lib/format";
import { listShiftsForFamily } from "@/lib/queries";

// A shift is still callable off until it has actually happened.
const CANCELLABLE = new Set(["scheduled", "checked_in", "absence_reported"]);

/** CRUD-02. Newest first, showing date, time, caregiver and status. */
export default async function ShiftsPage() {
  const profile = await requireRole("parent");
  const shifts = await listShiftsForFamily(profile.id);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your shifts</h1>
          <Link
            href="/parent"
            className="mt-1 inline-block text-sm text-neutral-600 hover:text-neutral-900"
          >
            Back to dashboard
          </Link>
        </div>
        <Link
          href="/parent/shifts/new"
          className="shrink-0 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          Schedule shift
        </Link>
      </header>

      {shifts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-600">
          Schedule your first shift and it will show up here. Once a shift is
          booked, TrustNanny can cover it if your caregiver can&apos;t come.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
          {shifts.map((shift) => (
            <li
              key={shift.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {formatShiftDate(shift.shift_date)}
                  </span>
                  <span className="font-mono text-sm tabular-nums text-neutral-600">
                    {formatTimeRange(shift.start_time, shift.end_time)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-sm text-neutral-600">
                  {shift.caregiver?.full_name ?? "No caregiver assigned"}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(shift.status)}`}
                >
                  {statusLabel(shift.status)}
                </span>
                <Link
                  href={`/parent/shifts/${shift.id}`}
                  className="text-sm text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline"
                >
                  Edit
                </Link>
                {CANCELLABLE.has(shift.status) && (
                  <CancelShiftButton shiftId={shift.id} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
