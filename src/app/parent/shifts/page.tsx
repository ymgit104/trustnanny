import Link from "next/link";
import { CancelShiftButton } from "@/components/cancel-shift-button";
import { EmptyState, StatusChip } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { formatShiftDate, formatTimeRange } from "@/lib/format";
import { listShiftsForFamily } from "@/lib/queries";

// A shift is still callable off until it has actually happened.
const CANCELLABLE = new Set(["scheduled", "checked_in", "absence_reported"]);

/** CRUD-02. Newest first, showing date, time, caregiver and status. */
export default async function ShiftsPage() {
  const profile = await requireRole("parent");
  const shifts = await listShiftsForFamily(profile.id);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-app flex-col gap-5 px-4 py-8 sm:px-8">
      <header>
        <Link
          href="/parent"
          className="font-mono text-xs text-ink-soft transition hover:text-trust"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">
          Scheduled shifts
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Manage your upcoming childcare coverage.
        </p>
        <Link href="/parent/shifts/new" className="btn-primary mt-4">
          <PlusMark />
          Schedule shift
        </Link>
      </header>

      {shifts.length === 0 ? (
        <EmptyState>
          Schedule your first shift and it will show up here. Once a shift is
          booked, TrustNanny can cover it if your caregiver can&apos;t come.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {shifts.map((shift) => (
            <li
              key={shift.id}
              className={`card overflow-hidden border-l-4 ${ACCENT[shift.status] ?? "border-l-edge-strong"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <StatusChip status={shift.status} />
                  <p className="mt-1.5 text-base font-bold tracking-tight text-ink">
                    {shift.caregiver?.full_name ?? "No caregiver assigned"}
                  </p>
                  <p className="label-caps mt-1.5">
                    {formatShiftDate(shift.shift_date)}
                  </p>
                  <p className="font-mono text-xl font-bold tabular-nums text-ink">
                    {formatTimeRange(shift.start_time, shift.end_time)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/parent/shifts/${shift.id}`}
                    className="btn-ghost px-3 py-2 text-xs"
                  >
                    Edit
                  </Link>
                  {CANCELLABLE.has(shift.status) && (
                    <CancelShiftButton shiftId={shift.id} />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

const ACCENT: Record<string, string> = {
  scheduled: "border-l-trust",
  checked_in: "border-l-calm",
  completed: "border-l-edge-strong",
  absence_reported: "border-l-critical",
  cancelled: "border-l-edge",
};

function PlusMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
