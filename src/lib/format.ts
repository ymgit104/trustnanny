import {
  communityInstant,
  communityToday,
  daysBetween,
} from "@/lib/community-time.mjs";
import type { ShiftStatus } from "@/lib/types";

/**
 * The instant a stored shift actually begins.
 *
 * Reads the naive date and time columns on the community's clock rather than
 * the server's. Using the server's clock meant the same row answered "has this
 * started?" differently in local development (IST) and on Vercel (UTC), which
 * hid the absence button on the live deployment entirely.
 */
export function shiftStartsAt(shiftDate: string, startTime: string): Date {
  return communityInstant(shiftDate, startTime);
}

/** Whether a shift's day has arrived in the community. ISO dates sort, so this
 *  is a string comparison rather than any date arithmetic. */
export function isOnOrBeforeToday(shiftDate: string): boolean {
  return shiftDate <= communityToday();
}

const RELATIVE: Record<number, string> = {
  "-1": "Yesterday",
  0: "Today",
  1: "Tomorrow",
};

/**
 * "Today", "Yesterday", "Tomorrow", else "Wed 27 Aug".
 *
 * Relative to today *in the community*, not in whoever's browser is looking.
 * This runs client-side, so without that the server could call a shift today
 * while the viewer's device called it yesterday - which is exactly what the
 * live deployment did.
 */
export function formatShiftDate(shiftDate: string): string {
  const diff = daysBetween(communityToday(), shiftDate);
  const relative = RELATIVE[diff];
  if (relative) return relative;

  const [year, month, day] = shiftDate.split("-").map(Number);
  // Rendered in UTC from a pure date, so the label cannot drift a day either.
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Times are stored as HH:MM:SS; nobody needs the seconds. */
export function formatTime(time: string): string {
  return time.slice(0, 5);
}

export function formatTimeRange(startTime: string, endTime: string): string {
  return `${formatTime(startTime)}–${formatTime(endTime)}`;
}

/** FLOW-04. Counts up, so it can exceed the budget rather than wrapping. */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * FLOW-08. Seconds, because a live accept lands around forty seconds in and
 * "Filled in 0 min" reads as a bug rather than the win it is.
 *
 * Sub-second says "under a minute" instead of "0 seconds", which reads as a
 * failed measurement.
 */
export function formatFillTime(seconds: number): string {
  if (seconds < 1) return "under a minute";
  if (seconds < 60) return `${seconds} seconds`;

  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (rest === 0) return `${minutes} min`;
  return `${minutes} min ${rest} s`;
}

const STATUS_LABELS: Record<ShiftStatus, string> = {
  scheduled: "Scheduled",
  checked_in: "Checked in",
  completed: "Completed",
  absence_reported: "Absence reported",
  cancelled: "Cancelled",
};

export function statusLabel(status: ShiftStatus): string {
  return STATUS_LABELS[status];
}

const STATUS_CLASSES: Record<ShiftStatus, string> = {
  scheduled: "bg-neutral-100 text-neutral-700",
  checked_in: "bg-green-100 text-green-800",
  completed: "bg-neutral-100 text-neutral-500",
  absence_reported: "bg-red-100 text-red-800",
  cancelled: "bg-neutral-100 text-neutral-400 line-through",
};

export function statusClass(status: ShiftStatus): string {
  return STATUS_CLASSES[status];
}
