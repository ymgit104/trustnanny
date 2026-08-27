"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { checkIn, respondToOffer } from "@/lib/actions";
import {
  formatShiftDate,
  formatTimeRange,
  statusClass,
  statusLabel,
} from "@/lib/format";
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

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p
          role="alert"
          className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {error}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-neutral-600">
          Cover needed
        </h2>

        {offers.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-600">
            Nothing needs covering right now. Requests show up here the moment a
            family needs someone.
          </p>
        ) : (
          offers.map((offer) => (
            <article
              key={offer.id}
              className="flex flex-col gap-3 rounded-lg border-2 border-neutral-900 p-4"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{offer.familyName}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      offer.known
                        ? "bg-green-100 text-green-800"
                        : "bg-neutral-200 text-neutral-700"
                    }`}
                  >
                    {offer.known
                      ? "You've worked here before"
                      : "New family for you"}
                  </span>
                </div>

                <p className="mt-1 text-sm text-neutral-600">
                  Block {offer.block ?? "—"}, flat {offer.flat ?? "—"}
                </p>

                <p className="mt-1 text-sm">
                  <span className="text-neutral-600">
                    {formatShiftDate(offer.shiftDate)}{" "}
                  </span>
                  <span className="font-mono tabular-nums">
                    {formatTimeRange(offer.startTime, offer.endTime)}
                  </span>
                </p>

                {offer.notes && (
                  <p className="mt-2 rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                    {offer.notes}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy?.id === offer.id}
                  onClick={() =>
                    run(offer.id, "accept", () =>
                      respondToOffer(offer.id, "accepted"),
                    )
                  }
                  className="flex-1 rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50"
                >
                  {busy?.id === offer.id && busy.action === "accept"
                    ? "Accepting…"
                    : "Accept"}
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
                  className="rounded-md border border-neutral-300 px-4 py-2.5 text-sm font-medium transition hover:bg-neutral-50 disabled:opacity-50"
                >
                  {busy?.id === offer.id && busy.action === "decline"
                    ? "Declining…"
                    : "Can't make it"}
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-neutral-600">Your shifts</h2>

        {shifts.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-600">
            You have no shifts booked. Families you work with will show up here.
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
                      {formatShiftDate(shift.shiftDate)}
                    </span>
                    <span className="font-mono text-sm tabular-nums text-neutral-600">
                      {formatTimeRange(shift.startTime, shift.endTime)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-neutral-600">
                    {shift.familyName} · block {shift.block ?? "—"}, flat{" "}
                    {shift.flat ?? "—"}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(shift.status)}`}
                  >
                    {statusLabel(shift.status)}
                  </span>
                  {shift.canCheckIn && (
                    <button
                      type="button"
                      disabled={busy?.id === shift.id}
                      onClick={() =>
                        run(shift.id, "checkin", () => checkIn(shift.id))
                      }
                      className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
                    >
                      {busy?.id === shift.id
                        ? "Checking in…"
                        : "I've arrived"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
