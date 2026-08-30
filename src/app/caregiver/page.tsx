import {
  CaregiverPanel,
  type CaregiverShift,
} from "@/components/caregiver-panel";
import { DemoBar } from "@/components/demo-bar";
import { SignOutButton } from "@/components/sign-out-button";
import { AppHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { isOnOrBeforeToday } from "@/lib/format";
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
      shift.status === "scheduled" && isOnOrBeforeToday(shift.shift_date),
  }));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-app flex-col gap-5 px-4 py-8 sm:px-8">
      <AppHeader
        title={`Hello, ${profile.full_name || "there"}`}
        subtitle={`Level ${profile.level ?? "—"} · ${profile.tenure_months} months with TrustNanny`}
        action={<SignOutButton />}
      />

      {process.env.ENABLE_DEMO_RESET === "true" && <DemoBar />}

      <CaregiverPanel offers={offers} shifts={rows} />
    </main>
  );
}
