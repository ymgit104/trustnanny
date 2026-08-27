"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getSearchState, reportAbsence, widenSearch } from "@/lib/actions";
import type { SearchSnapshot } from "@/lib/dispatch";
import {
  formatClock,
  formatFillTime,
  formatShiftDate,
  formatTimeRange,
  statusClass,
  statusLabel,
} from "@/lib/format";
import type { ShiftStatus } from "@/lib/types";

const POLL_MS = 3000;

/** A search still moving. Once it settles there is nothing left to poll for. */
const LIVE = new Set(["open", "awaiting_consent"]);

type Props = {
  shiftId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  status: ShiftStatus;
  caregiverName: string | null;
  checkedIn: boolean;
  /** Start time has passed with no check-in. Server-computed to avoid clock skew. */
  isLate: boolean;
  initialSnapshot: SearchSnapshot;
};

export function ParentShiftPanel({
  shiftId,
  shiftDate,
  startTime,
  endTime,
  status,
  caregiverName,
  checkedIn,
  isLate,
  initialSnapshot,
}: Props) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const searchIsLive = LIVE.has(snapshot.searchStatus);

  // The server is the authority. useState only seeds from a prop once, so
  // without this the panel keeps its first snapshot forever: reporting an
  // absence would flip the shift to a live search on the server while this
  // component still believed there was none, and polling would never start.
  useEffect(() => {
    setSnapshot(initialSnapshot);
  }, [initialSnapshot]);

  // FLOW-03. Three seconds is invisible against a ninety-minute clock, and it
  // costs one small request - which is why this is polling and not websockets.
  useEffect(() => {
    if (!searchIsLive) return;

    const id = setInterval(async () => {
      const next = await getSearchState(shiftId);
      if (next) {
        setSnapshot(next);
        // A finished search changes the rest of the page too, not just this
        // panel, so let the server re-render once it settles.
        if (!LIVE.has(next.searchStatus)) router.refresh();
      }
    }, POLL_MS);

    return () => clearInterval(id);
  }, [searchIsLive, shiftId, router]);

  // The clock ticks locally so it moves every second rather than jumping in
  // three-second steps.
  useEffect(() => {
    if (!searchIsLive) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [searchIsLive]);

  const run = useCallback(
    async (action: () => Promise<{ error: string } | void>) => {
      setPending(true);
      setError(null);
      const result = await action();
      if (result?.error) setError(result.error);
      setPending(false);
      setConfirming(false);
      router.refresh();
    },
    [router],
  );

  const openedAt = snapshot.searchOpenedAt
    ? new Date(snapshot.searchOpenedAt).getTime()
    : null;
  const elapsed =
    openedAt === null ? 0 : Math.max(0, Math.floor((now - openedAt) / 1000));
  const overBudget = elapsed > snapshot.budgetSeconds;
  const progress = Math.min(100, (elapsed / snapshot.budgetSeconds) * 100);

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-4">
      <div>
        <h2 className="text-sm font-medium text-neutral-600">
          {status === "completed" ? "Most recent shift" : "Current shift"}
        </h2>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="font-medium">{formatShiftDate(shiftDate)}</span>
          <span className="font-mono text-sm tabular-nums text-neutral-600">
            {formatTimeRange(startTime, endTime)}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(status)}`}
          >
            {statusLabel(status)}
          </span>
        </div>

        <p className="mt-1 text-sm text-neutral-600">
          {caregiverName ?? "No caregiver assigned"}
          {checkedIn && " · arrived"}
        </p>
      </div>

      {/* FLOW-02. Only appears once she is actually late, so it is never a
          button you could press by accident on a normal morning.

          Gated on search_status === 'none' to match reportAbsence's own guard
          exactly. A shift that has already been through a search is done: a
          second wave is explicitly out of scope, and offering a button that the
          action would refuse is worse than offering no button. */}
      {isLate && snapshot.searchStatus === "none" && (
        <div>
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="w-full rounded-md bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              She hasn&apos;t come
            </button>
          ) : (
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-900">
                Start looking for a replacement now?
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => reportAbsence(shiftId))}
                  className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {pending ? "Starting…" : "Yes, find someone"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirming(false)}
                  className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                >
                  Not yet
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FLOW-03. Rendered here rather than on a route of its own: no
          navigation, no page transition, nothing to lose mid-search. */}
      {searchIsLive && (
        <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium">
              {snapshot.searchStatus === "awaiting_consent"
                ? "Waiting for you"
                : "Looking for cover"}
            </span>
            <span
              className={`font-mono text-lg tabular-nums ${overBudget ? "text-red-700" : ""}`}
            >
              {formatClock(elapsed)}
              <span className="text-sm text-neutral-500"> / 90:00</span>
            </span>
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200">
            <div
              className={`h-full transition-all duration-1000 ${overBudget ? "bg-red-600" : "bg-neutral-900"}`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {snapshot.searchStatus === "awaiting_consent" ? (
            // RULE 3. Nobody the family knows is free. The engine stops here
            // and asks rather than quietly sending a stranger.
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-900">
                Nobody you&apos;ve worked with before is free right now.
                {snapshot.strangersAvailable > 0
                  ? ` ${snapshot.strangersAvailable} verified ${snapshot.strangersAvailable === 1 ? "caregiver" : "caregivers"} you haven't met ${snapshot.strangersAvailable === 1 ? "is" : "are"} available.`
                  : ""}
              </p>
              <button
                type="button"
                disabled={pending || snapshot.strangersAvailable === 0}
                onClick={() => run(() => widenSearch(shiftId))}
                className="mt-2 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
              >
                {pending ? "Asking…" : "Ask someone new"}
              </button>
            </div>
          ) : (
            <OfferList offers={snapshot.offers} />
          )}
        </div>
      )}

      {snapshot.searchStatus === "filled" && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-900">
          <span className="font-medium">
            {snapshot.caregiverName ?? "A caregiver"} is coming.
          </span>
          {snapshot.filledInSeconds !== null &&
            ` Filled in ${formatFillTime(snapshot.filledInSeconds)}.`}
        </p>
      )}

      {snapshot.searchStatus === "unfilled" && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900">
          Nobody was able to cover this one. We&apos;ve stopped looking so you
          can make other arrangements.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}

function OfferList({ offers }: { offers: SearchSnapshot["offers"] }) {
  if (offers.length === 0) {
    return <p className="text-sm text-neutral-600">Sending the first asks…</p>;
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {offers.map((offer, index) => (
        <li
          key={`${offer.caregiverName}-${index}`}
          className="flex items-center justify-between gap-3 text-sm"
        >
          <span className="flex items-center gap-2">
            <span>{offer.caregiverName}</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${
                offer.known
                  ? "bg-green-100 text-green-800"
                  : "bg-neutral-200 text-neutral-700"
              }`}
            >
              {offer.known ? "You know her" : "New to you"}
            </span>
          </span>
          <span className="text-neutral-600">{RESPONSE_LABEL[offer.response]}</span>
        </li>
      ))}
    </ul>
  );
}

const RESPONSE_LABEL: Record<SearchSnapshot["offers"][number]["response"], string> =
  {
    pending: "Asked",
    accepted: "Accepted",
    declined: "Can't make it",
    voided: "—",
  };
