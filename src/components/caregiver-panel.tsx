"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, KnownChip, SectionLabel, StatusChip } from "@/components/ui";
import { checkIn, respondToOffer } from "@/lib/actions";
import { formatShiftDate, formatTimeRange } from "@/lib/format";
import type { PendingOffer, ShiftStatus } from "@/lib/types";

const POLL_MS = 3000;

export type CaregiverShift = {
  id: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  status: ShiftStatus;
  familyName: string;
  block: string | null;
  flat: string | null;
  notes: string | null;
  canCheckIn: boolean;
};

/**
 * FLOW-06 and FLOW-09 on one screen. No navigation: a caregiver answering an
 * offer at 7:40am should never have to find a second page.
 *
 * Styled as professional tooling rather than gig-work chrome - no rating, no
 * score, no streak. Dignity in utility.
 */
export function CaregiverPanel({
  offers,
  shifts,
}: {
  offers: PendingOffer[];
  shifts: CaregiverShift[];
}) {
  const router = useRouter();
  // Tracks which action is in flight, not just which card, so the button can
  // say what it is doing rather than showing a bare ellipsis.
  const [busy, setBusy] = useState<{ id: string; action: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // An offer arrives while she is already looking at this screen, so it has to
  // appear on its own. Same three-second poll as the parent's live search, for
  // the same reason: it is cheap and it is invisible against a 90-minute clock.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [router]);

  const run = useCallback(
    async (
      key: string,
      name: string,
      action: () => Promise<{ error: string } | void>,
    ) => {
      setBusy({ id: key, action: name });
      setError(null);
      const result = await action();
      if (result?.error) setError(result.error);
      setBusy(null);
      router.refresh();
    },
    [router],
  );

  const next = shifts.find((shift) => shift.canCheckIn);
  const rest = shifts.filter((shift) => shift.id !== next?.id);

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <p
          role="alert"
          className="rounded border border-safety/30 bg-orange-50 px-3 py-2 text-sm text-orange-900"
        >
          {error}
        </p>
      )}

      {/* FLOW-09. Arrival is the whole point of the product, so the check-in
          sits above everything else the moment a shift is due. */}
      {next && (
        <div className="card overflow-hidden border-l-4 border-l-trust">
          <div className="flex items-start justify-between gap-4 p-5">
            <div className="min-w-0">
              <p className="label-caps">Next shift</p>
              <p className="mt-1.5 text-lg font-bold tracking-tight text-ink">
                {next.familyName}
              </p>
              <p className="mt-1 flex items-center gap-1.5 font-mono text-xs text-ink-soft">
                <PinMark />
                Block {next.block ?? "—"}, flat {next.flat ?? "—"}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="label-caps">Start</p>
              <p className="font-mono text-timer-sm font-bold tabular-nums text-ink">
                {next.startTime.slice(0, 5)}
              </p>
            </div>
          </div>
          <div className="border-t border-edge p-5 pt-4">
            <button
              type="button"
              disabled={busy?.id === next.id}
              onClick={() => run(next.id, "checkin", () => checkIn(next.id))}
              className="btn-primary w-full py-3 text-base"
            >
              {busy?.id === next.id ? "Checking in…" : "I've arrived"}
            </button>
          </div>
        </div>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <SectionLabel>Cover needed</SectionLabel>
          {offers.length > 0 && (
            <span className="rounded-full bg-safety/15 px-2 py-0.5 font-mono text-[0.625rem] font-semibold uppercase tracking-caps text-orange-800">
              High priority
            </span>
          )}
        </div>

        {offers.length === 0 ? (
          <EmptyState>
            Nothing needs covering right now. Requests show up here the moment a
            family needs someone.
          </EmptyState>
        ) : (
          offers.map((offer) => (
            <article
              key={offer.id}
              className="card border-safety/50 shadow-focus"
            >
              <div className="flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-lg font-bold tracking-tight text-ink">
                    {offer.familyName}
                  </p>
                  <KnownChip known={offer.known} />
                </div>

                <div className="flex flex-col gap-1 font-mono text-xs text-ink-soft">
                  <span className="flex items-center gap-1.5">
                    <ClockMark />
                    {formatShiftDate(offer.shiftDate).toUpperCase()},{" "}
                    {formatTimeRange(offer.startTime, offer.endTime)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <PinMark />
                    Block {offer.block ?? "—"}, flat {offer.flat ?? "—"}
                  </span>
                </div>

                {offer.notes && (
                  <p className="rounded border border-edge bg-canvas px-3 py-2 text-sm text-ink-soft">
                    {offer.notes}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy?.id === offer.id}
                    onClick={() =>
                      run(offer.id, "accept", () =>
                        respondToOffer(offer.id, "accepted"),
                      )
                    }
                    className="btn flex-1 bg-calm py-3 text-base text-white hover:bg-emerald-600"
                  >
                    {busy?.id === offer.id && busy.action === "accept"
                      ? "Accepting…"
                      : "Accept shift"}
                  </button>
                  {/* RULE 5. Declining costs her nothing, so it is a plain
                      button, not a reluctant link buried in small print. */}
                  <button
                    type="button"
                    disabled={busy?.id === offer.id}
                    onClick={() =>
                      run(offer.id, "decline", () =>
                        respondToOffer(offer.id, "declined"),
                      )
                    }
                    className="btn-ghost py-3"
                  >
                    {busy?.id === offer.id && busy.action === "decline"
                      ? "Declining…"
                      : "Can't make it"}
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionLabel>Your shifts</SectionLabel>

        {rest.length === 0 ? (
          <EmptyState>
            You have no other shifts booked. Families you work with will show up
            here.
          </EmptyState>
        ) : (
          <ul className="card divide-y divide-edge">
            {rest.map((shift) => (
              <li
                key={shift.id}
                className="flex items-center gap-3 px-4 py-3.5"
              >
                <DateTile shiftDate={shift.shiftDate} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {shift.familyName}
                  </p>
                  <p className="font-mono text-xs text-ink-soft">
                    {formatTimeRange(shift.startTime, shift.endTime)}
                  </p>
                </div>
                <StatusChip status={shift.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Calendar-tile date, so a list of shifts scans by day rather than by reading. */
function DateTile({ shiftDate }: { shiftDate: string }) {
  const [, month, day] = shiftDate.split("-");
  const name = new Date(2000, Number(month) - 1, 1).toLocaleDateString("en-GB", {
    month: "short",
  });

  return (
    <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded bg-trust-tint">
      <span className="font-mono text-[0.5625rem] font-semibold uppercase tracking-caps text-trust">
        {name}
      </span>
      <span className="font-mono text-sm font-bold leading-none tabular-nums text-trust-deep">
        {day}
      </span>
    </div>
  );
}

function PinMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function ClockMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
