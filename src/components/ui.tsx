import { statusLabel } from "@/lib/format";
import type { ShiftStatus } from "@/lib/types";

/**
 * Presentational primitives shared across every screen. No data access, no
 * actions — restyling one of these restyles the whole product.
 */

const STATUS_TONE: Record<ShiftStatus, { dot: string; text: string }> = {
  scheduled: { dot: "bg-trust", text: "text-ink-soft" },
  checked_in: { dot: "bg-calm", text: "text-calm" },
  completed: { dot: "bg-ink-faint", text: "text-ink-faint" },
  absence_reported: { dot: "bg-critical", text: "text-critical" },
  cancelled: { dot: "bg-edge-strong", text: "text-ink-faint line-through" },
};

/**
 * A coloured dot plus monospace caps, never a filled pill — pills read as
 * buttons, and a status is not something you can press.
 */
export function StatusChip({ status }: { status: ShiftStatus }) {
  const tone = STATUS_TONE[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 font-mono text-[0.6875rem] font-semibold uppercase tracking-caps ${tone.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden />
      {statusLabel(status)}
    </span>
  );
}

/**
 * Whether this caregiver has worked for this family before — Rule 1 made
 * visible. The whole ranking exists to put "you know her" at the top, so it
 * gets the only green badge on the screen.
 */
export function KnownChip({ known }: { known: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded border px-2 py-1 font-mono text-[0.625rem] font-semibold uppercase tracking-caps ${
        known
          ? "border-calm/30 bg-calm/10 text-emerald-800"
          : "border-edge bg-canvas text-ink-faint"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${known ? "bg-calm" : "bg-ink-faint"}`}
        aria-hidden
      />
      {known ? "Worked here before" : "New to you"}
    </span>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="label-caps">{children}</h2>;
}

/** Empty states are instructions, not apologies. */
export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-edge-strong bg-white/60 p-5 text-sm text-ink-soft">
      {children}
    </p>
  );
}

export function AppHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && (
          <p className="mt-1 font-mono text-xs text-ink-soft">{subtitle}</p>
        )}
      </div>
      {action}
    </header>
  );
}
