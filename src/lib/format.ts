import type { ShiftStatus } from "@/lib/types";

/**
 * Builds a local Date from a `YYYY-MM-DD` column.
 *
 * `new Date("2026-08-27")` is parsed as UTC midnight, which lands on the
 * previous day for anyone west of Greenwich. Splitting the parts and using the
 * local constructor keeps a date column meaning the day it says.
 */
export function parseLocalDate(shiftDate: string): Date {
  const [year, month, day] = shiftDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Combines the date and time columns into one local instant. */
export function shiftStartsAt(shiftDate: string, startTime: string): Date {
  const at = parseLocalDate(shiftDate);
  const [hours, minutes] = startTime.split(":").map(Number);
  at.setHours(hours, minutes, 0, 0);
  return at;
}

const DAY = 24 * 60 * 60 * 1000;

/** "Today", "Yesterday", "Tomorrow", else "Wed 27 Aug". */
export function formatShiftDate(shiftDate: string): string {
  const date = parseLocalDate(shiftDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.round((date.getTime() - today.getTime()) / DAY);
  if (diffDays === 0) return "Today";
  if (diffDays === -1) return "Yesterday";
  if (diffDays === 1) return "Tomorrow";

  return date.toLocaleDateString("en-GB", {
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
