"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { KnownChip, StatusChip } from "@/components/ui";
import { getSearchState, reportAbsence, widenSearch } from "@/lib/actions";
import type { SearchSnapshot } from "@/lib/dispatch";
import { formatClock, formatFillTime, formatShiftDate } from "@/lib/format";
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
    <section className="flex flex-col gap-4">
      {/* The active status card sits at the top of the stack always: at 7:40am
          it must be the first thing seen, with no scrolling. */}
      <div className="card overflow-hidden">
        <div className="flex items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <p className="label-caps">
              {status === "completed" ? "Most recent shift" : "Current shift"}
            </p>
            <p className="mt-1.5 text-lg font-bold tracking-tight text-ink">
              {caregiverName ?? "No caregiver assigned"}
            </p>
            <p className="mt-0.5 font-mono text-xs text-ink-soft">
              {formatShiftDate(shiftDate)}
            </p>
            <div className="mt-2">
              <StatusChip status={checkedIn ? "checked_in" : status} />
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="label-caps">Start</p>
            <p className="font-mono text-timer-sm font-bold tabular-nums text-ink">
              {startTime.slice(0, 5)}
            </p>
            <p className="mt-1 font-mono text-[0.6875rem] text-ink-faint">
              until {endTime.slice(0, 5)}
            </p>
          </div>
        </div>

        {/* FLOW-02. Only appears once she is actually late, so it is never a
            button you could press by accident on a normal morning.

            Gated on search_status === 'none' to match reportAbsence's own guard
            exactly. A shift that has already been through a search is done: a
            second wave is explicitly out of scope, and offering a button that
            the action would refuse is worse than offering no button. */}
        {isLate && snapshot.searchStatus === "none" && (
          <div className="border-t border-edge p-5 pt-4">
            {!confirming ? (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="btn-critical w-full py-3 text-base"
              >
                <AlertMark />
                She hasn&apos;t come
              </button>
            ) : (
              <div className="rounded border border-critical/30 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-900">
                  Start looking for a replacement now?
                </p>
                <p className="mt-1 text-sm text-red-800">
                  We&apos;ll ask caregivers you already know first.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => reportAbsence(shiftId))}
                    className="btn-critical flex-1"
                  >
                    {pending ? "Starting…" : "Yes, find someone"}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setConfirming(false)}
                    className="btn-ghost"
                  >
                    Not yet
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FLOW-03. Rendered here rather than on a route of its own: no
          navigation, no page transition, nothing to lose mid-search. */}
      {searchIsLive && (
        <div className="card border-trust/40 p-5">
          <p className="text-center label-caps">Elapsed search time</p>
          <p
            className={`mt-1 text-center font-mono text-timer font-bold tabular-nums ${
              overBudget ? "text-critical" : "text-trust"
            }`}
          >
            {formatClock(elapsed)}
          </p>
          <p className="mt-1 text-center font-mono text-[0.6875rem] text-ink-faint">
            of 90:00 promised
          </p>

          <div className="mt-4 h-1 overflow-hidden rounded-full bg-edge">
            <div
              className={`h-full transition-all duration-1000 ${overBudget ? "bg-critical" : "bg-trust"}`}
              style={{ width: `${progress}%` }}
            />
          </div>

          <SearchStepper searchStatus={snapshot.searchStatus} />

          <div className="mt-5 border-t border-edge pt-4">
            {snapshot.searchStatus === "awaiting_consent" ? (
              // RULE 3. Nobody the family knows is free. The engine stops here
              // and asks rather than quietly sending a stranger.
              <div className="rounded border border-safety/40 bg-orange-50 p-4">
                <p className="flex items-center gap-2 text-sm font-bold text-ink">
                  <AlertMark className="text-safety" />
                  Expand the search?
                </p>
                <p className="mt-1.5 text-sm text-ink-soft">
                  Nobody you&apos;ve worked with before is free right now.
                  {snapshot.strangersAvailable > 0 &&
                    ` ${snapshot.strangersAvailable} verified ${
                      snapshot.strangersAvailable === 1
                        ? "caregiver you haven't met is"
                        : "caregivers you haven't met are"
                    } available.`}
                </p>
                <button
                  type="button"
                  disabled={pending || snapshot.strangersAvailable === 0}
                  onClick={() => run(() => widenSearch(shiftId))}
                  className="btn-primary mt-3 w-full"
                >
                  {pending ? "Asking…" : "Ask someone new"}
                </button>
              </div>
            ) : (
              <OfferLog offers={snapshot.offers} />
            )}
          </div>
        </div>
      )}

      {snapshot.searchStatus === "filled" && (
        <div className="card border-calm/40 bg-emerald-50/60 p-5">
          <p className="label-caps text-emerald-700">Covered</p>
          <p className="mt-1.5 text-lg font-bold tracking-tight text-ink">
            {snapshot.caregiverName ?? "A caregiver"} is coming.
          </p>
          {snapshot.filledInSeconds !== null && (
            <p className="mt-1 font-mono text-sm text-emerald-800">
              Filled in {formatFillTime(snapshot.filledInSeconds)}.
            </p>
          )}
        </div>
      )}

      {snapshot.searchStatus === "unfilled" && (
        <div className="card border-critical/30 bg-red-50 p-5">
          <p className="label-caps text-red-700">Not covered</p>
          <p className="mt-1.5 text-sm text-red-900">
            Nobody was able to cover this one. We&apos;ve stopped looking so you
            can make other arrangements.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-critical">
          {error}
        </p>
      )}
    </section>
  );
}

/**
 * The search_status state machine, drawn. A parent watching this can see which
 * of three things is happening without reading a word of explanation - and it
 * makes the consent gate a visible stop rather than an unexplained pause.
 */
function SearchStepper({
  searchStatus,
}: {
  searchStatus: SearchSnapshot["searchStatus"];
}) {
  const steps = ["Searching", "Awaiting consent", "Filled"] as const;
  const activeIndex =
    searchStatus === "awaiting_consent" ? 1 : searchStatus === "filled" ? 2 : 0;

  return (
    <ol className="mt-4 flex items-start">
      {steps.map((step, index) => {
        const done = index < activeIndex;
        const active = index === activeIndex;

        return (
          <li key={step} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <span
                className={`h-px flex-1 ${index === 0 ? "bg-transparent" : done || active ? "bg-trust" : "bg-edge"}`}
              />
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                  done
                    ? "border-trust bg-trust text-white"
                    : active
                      ? "border-trust bg-white"
                      : "border-edge bg-white"
                }`}
              >
                {done ? (
                  <CheckMark />
                ) : (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${active ? "bg-trust" : "bg-edge"}`}
                  />
                )}
              </span>
              <span
                className={`h-px flex-1 ${index === steps.length - 1 ? "bg-transparent" : done ? "bg-trust" : "bg-edge"}`}
              />
            </div>
            <span
              className={`mt-1.5 text-center font-mono text-[0.625rem] font-semibold uppercase tracking-caps ${
                done || active ? "text-trust" : "text-ink-faint"
              }`}
            >
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Who was asked and what they said. Reads as a log rather than a list, because
 * during a search the question is "what has happened so far".
 */
function OfferLog({ offers }: { offers: SearchSnapshot["offers"] }) {
  if (offers.length === 0) {
    return (
      <p className="font-mono text-xs text-ink-soft">Sending the first asks…</p>
    );
  }

  return (
    <>
      <p className="label-caps">Who we&apos;ve asked</p>
      <ul className="mt-2 divide-y divide-edge">
        {offers.map((offer, index) => (
          <li
            key={`${offer.caregiverName}-${index}`}
            className="flex flex-wrap items-center justify-between gap-2 py-2.5"
          >
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-ink">
                {offer.caregiverName}
              </span>
              <KnownChip known={offer.known} />
            </span>
            <span
              className={`font-mono text-[0.6875rem] font-semibold uppercase tracking-caps ${
                RESPONSE_TONE[offer.response]
              }`}
            >
              {RESPONSE_LABEL[offer.response]}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

const RESPONSE_LABEL: Record<
  SearchSnapshot["offers"][number]["response"],
  string
> = {
  pending: "Asked",
  accepted: "Accepted",
  declined: "Can't make it",
  voided: "—",
};

const RESPONSE_TONE: Record<
  SearchSnapshot["offers"][number]["response"],
  string
> = {
  pending: "text-trust",
  accepted: "text-calm",
  declined: "text-ink-faint",
  voided: "text-ink-faint",
};

function AlertMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}

function CheckMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3"
      fill="none"
      stroke="currentColor"
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}
