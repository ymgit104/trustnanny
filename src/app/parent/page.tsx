import Link from "next/link";
import { DemoBar } from "@/components/demo-bar";
import { ParentShiftPanel } from "@/components/parent-shift-panel";
import { SignOutButton } from "@/components/sign-out-button";
import { AppHeader, EmptyState } from "@/components/ui";
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
    <main className="mx-auto flex min-h-screen w-full max-w-app flex-col gap-5 px-4 py-8 sm:px-8">
      <AppHeader
        title={`Hello, ${profile.full_name || "there"}`}
        subtitle={`Block ${profile.block ?? "—"} · Flat ${profile.flat ?? "—"}`}
        action={<SignOutButton />}
      />

      {process.env.ENABLE_DEMO_RESET === "true" && <DemoBar />}

      {shift === null || snapshot === null ? (
        <EmptyState>
          Nothing booked yet. Schedule a shift and TrustNanny can cover it if
          your caregiver can&apos;t come.
        </EmptyState>
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
          hint="For immediate dispatch"
          mono
        />
        <StatCard
          label="Insurance"
          value={insuranceStatus(profile.insurance_valid_to)}
        />
      </div>

      <Link
        href="/parent/shifts"
        className="card flex items-center justify-between p-4 text-sm font-semibold text-ink transition hover:border-trust/40"
      >
        All your shifts
        <ChevronMark />
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
  hint,
  mono,
}: {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <div className="card p-4">
      <p className="label-caps">{label}</p>
      <p
        className={`mt-1.5 font-bold text-ink ${mono ? "font-mono text-2xl tabular-nums text-trust" : "text-base"}`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[0.6875rem] text-ink-faint">{hint}</p>}
    </div>
  );
}

function ChevronMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 text-ink-faint"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
