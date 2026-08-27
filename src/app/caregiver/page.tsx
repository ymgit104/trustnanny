import {
  CaregiverPanel,
  type CaregiverShift,
} from "@/components/caregiver-panel";
import { SignOutButton } from "@/components/sign-out-button";
import { requireRole } from "@/lib/auth";
import { parseLocalDate } from "@/lib/format";
import {
  listPendingOffersForCaregiver,
  listShiftsForCaregiver,
} from "@/lib/queries";

export default async function CaregiverDashboard() {
  const profile = await requireRole("caregiver");

  const [offers, shifts] = await Promise.all([
    listPendingOffersForCaregiver(profile.id),
    listShiftsForCaregiver(profile.id),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows: CaregiverShift[] = shifts.map((shift) => ({
    id: shift.id,
    shiftDate: shift.shift_date,
    startTime: shift.start_time,
    endTime: shift.end_time,
    status: shift.status,
    familyName: shift.family?.full_name ?? "A family",
    block: shift.family?.block ?? null,
    flat: shift.family?.flat ?? null,
    notes: shift.notes,
    // Any shift due today or earlier that she has not arrived at yet. Deliberately
    // not gated on the exact start time: a caregiver who turns up ten minutes
    // early should not be told the button is not ready for her.
    canCheckIn:
      shift.status === "scheduled" &&
      parseLocalDate(shift.shift_date).getTime() <= today.getTime(),
  }));

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-6 py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Hello, {profile.full_name || "there"}
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Level {profile.level ?? "—"} · {profile.tenure_months} months with
            TrustNanny
          </p>
        </div>
        <SignOutButton />
      </header>

      <CaregiverPanel offers={offers} shifts={rows} />
    </main>
  );
}
