import Link from "next/link";
import { DemoBar } from "@/components/demo-bar";
import { ParentShiftPanel } from "@/components/parent-shift-panel";
import { SignOutButton } from "@/components/sign-out-button";
import { requireRole } from "@/lib/auth";
import { getSearchSnapshot } from "@/lib/dispatch";
import { shiftStartsAt } from "@/lib/format";
import { getCurrentOrMostRecentShift } from "@/lib/queries";

export default async function ParentDashboard() {
  const profile = await requireRole("parent");
  const shift = await getCurrentOrMostRecentShift(profile.id);
  const snapshot = shift ? await getSearchSnapshot(profile, shift) : null;

  // FLOW-01. Computed on the server so a wrong clock on the parent's phone
  // cannot make the absence button appear early or hide it when it is needed.
  const isLate =
    shift !== null &&
    shift.status === "scheduled" &&
    shift.checkin_at === null &&
    shiftStartsAt(shift.shift_date, shift.start_time).getTime() <= Date.now();

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-6 py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Hello, {profile.full_name || "there"}
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Block {profile.block ?? "—"}, flat {profile.flat ?? "—"}
          </p>
        </div>
        <SignOutButton />
      </header>

      {process.env.ENABLE_DEMO_RESET === "true" && <DemoBar />}

      {shift === null || snapshot === null ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-600">
          Nothing booked yet. Schedule a shift and TrustNanny can cover it if
          your caregiver can&apos;t come.
        </p>
      ) : (
        <ParentShiftPanel
          shiftId={shift.id}
          shiftDate={shift.shift_date}
          startTime={shift.start_time}
          endTime={shift.end_time}
          status={shift.status}
          caregiverName={shift.caregiver?.full_name ?? null}
          checkedIn={shift.checkin_at !== null}
          isLate={isLate}
          initialSnapshot={snapshot}
        />
      )}

      {/* Static, per the brief: these make the product legible with no billing
          system behind them. */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Plan" value={titleCase(profile.plan_tier)} />
        <StatCard
          label="Backup credits"
          value={String(profile.backup_credits_remaining)}
          mono
        />
        <StatCard label="Insurance" value={insuranceStatus(profile.insurance_valid_to)} />
      </div>

      <Link
        href="/parent/shifts"
        className="text-sm text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline"
      >
        All your shifts
      </Link>
    </main>
  );
}

function insuranceStatus(validTo: string | null): string {
  if (!validTo) return "Included";
  const expires = new Date(validTo);
  if (Number.isNaN(expires.getTime())) return "Included";
  return expires.getTime() > Date.now() ? "Active" : "Expired";
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function StatCard({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 p-3">
      <p className="text-xs text-neutral-600">{label}</p>
      <p className={`mt-1 font-medium ${mono ? "font-mono tabular-nums" : ""}`}>
        {value}
      </p>
    </div>
  );
}
