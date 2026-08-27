import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Offer, Profile, Shift } from "@/lib/types";

/**
 * THE DISPATCH ENGINE
 *
 * Everything that decides who gets asked to cover an absence lives in this one
 * file, on purpose: the whole policy should be readable in a single sitting
 * rather than reconstructed from six modules.
 *
 * The five rules, in the order they matter:
 *
 *   1. Rank by familiarity, not distance.
 *   2. "Known" is derived, never stored.
 *   3. Strangers need explicit consent.
 *   4. First accept wins, decided by the database.
 *   5. Declining is free.
 *
 * ---------------------------------------------------------------------------
 * ON ATOMICITY - a known limitation, stated rather than hidden.
 *
 * Exactly one operation here has to be atomic, and it is: claiming a shift
 * (Rule 4). That is a single conditional UPDATE, so the database decides the
 * winner and a double booking is not representable.
 *
 * The bookkeeping that follows a win - marking the winner's offer accepted,
 * voiding the others, spending a backup credit - is NOT in the same
 * transaction. Supabase's REST interface does not expose multi-statement
 * transactions, and adding a Postgres function purely to wrap three harmless
 * writes was not worth the extra moving part on this budget.
 *
 * Why that is safe: none of those follow-ups can cause a double booking, and
 * all of them are idempotent. If the process died between winning and voiding,
 * the worst state is a filled shift with a stale pending offer - and an accept
 * on that stale offer is rejected by the same conditional update, because the
 * search is no longer open. The failure mode is a tidy-up we never did, not a
 * child left uncovered.
 * ---------------------------------------------------------------------------
 */

/** FLOW-04. The promise is 90 minutes; the UI counts up towards it. */
export const SEARCH_BUDGET_MINUTES = 90;

/**
 * How many caregivers hear about one absence at once.
 *
 * Three is a judgement, not a constant handed down: one at a time is too slow
 * against a 90-minute clock, and everybody at once turns a community into a
 * scramble where two people drop what they are doing for a shift only one of
 * them can have.
 */
export const MAX_PARALLEL_OFFERS = 3;

export type Candidate = {
  id: string;
  full_name: string;
  level: number;
  tenure_months: number;
  known: boolean;
};

export type SearchOutcome =
  | { kind: "offers_sent"; offered: Candidate[] }
  | { kind: "awaiting_consent"; strangersAvailable: number }
  | { kind: "nobody_available" };

export type ClaimOutcome =
  | { kind: "won" }
  | { kind: "already_filled" }
  | { kind: "search_closed" };

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

/**
 * The certification level a replacement must hold, from the age of the
 * youngest child in the house.
 *
 * Younger children need more qualified hands, and the thresholds are the point
 * where the skill genuinely changes: under one, you need someone trained on
 * infants; under three, someone trained on toddlers. Defaults to the strictest
 * level when the age is unknown, because guessing low is the dangerous
 * direction to guess in.
 */
export function requiredLevelFor(youngestChildAgeMonths: number | null): number {
  if (youngestChildAgeMonths === null) return 3;
  if (youngestChildAgeMonths < 12) return 3;
  if (youngestChildAgeMonths < 36) return 2;
  return 1;
}

/**
 * RULE 2 - "known" is derived, never stored.
 *
 * This query IS the definition of familiarity: has this caregiver completed at
 * least one shift for this family. There is no familiarity table and no
 * bookkeeping to keep in step, which means the pool of familiar caregivers
 * grows by itself every time a backup works out. Each emergency makes the next
 * one easier to fill, with nothing to maintain.
 */
export async function getKnownCaregiverIds(
  familyId: string,
): Promise<Set<string>> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("shifts")
    .select("caregiver_id")
    .eq("family_id", familyId)
    .eq("status", "completed")
    .not("caregiver_id", "is", null);

  if (error) throw new Error(`getKnownCaregiverIds: ${error.message}`);
  return new Set((data ?? []).map((row) => row.caregiver_id as string));
}

/** Caregivers already committed to an overlapping shift that day. */
async function getBookedCaregiverIds(shift: Shift): Promise<Set<string>> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("shifts")
    .select("caregiver_id, start_time, end_time")
    .eq("shift_date", shift.shift_date)
    .neq("id", shift.id)
    .in("status", ["scheduled", "checked_in"])
    .not("caregiver_id", "is", null);

  if (error) throw new Error(`getBookedCaregiverIds: ${error.message}`);

  // Two shifts clash when each starts before the other ends. Comparing the
  // times in JS keeps the overlap rule visible here rather than buried in a
  // SQL predicate nobody reads.
  const clashing = (data ?? []).filter(
    (other) =>
      other.start_time < shift.end_time && other.end_time > shift.start_time,
  );

  return new Set(clashing.map((row) => row.caregiver_id as string));
}

/**
 * Everyone who could actually turn up: available, qualified for this child, not
 * already booked in the slot, and not the person who just failed to show.
 *
 * Excluding the no-show needs no extra column. The shift keeps its original
 * caregiver_id for the whole search and is only overwritten when someone
 * accepts, so the row still remembers who let the family down.
 */
export async function getEligibleCandidates(
  family: Profile,
  shift: Shift,
): Promise<Candidate[]> {
  const admin = createAdminClient();
  const requiredLevel = requiredLevelFor(family.youngest_child_age_months);

  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, level, tenure_months")
    .eq("role", "caregiver")
    .eq("is_available", true)
    .gte("level", requiredLevel);

  if (error) throw new Error(`getEligibleCandidates: ${error.message}`);

  const [known, booked] = await Promise.all([
    getKnownCaregiverIds(family.id),
    getBookedCaregiverIds(shift),
  ]);

  return (data ?? [])
    .filter((row) => row.id !== shift.caregiver_id)
    .filter((row) => !booked.has(row.id))
    .map((row) => ({
      id: row.id as string,
      full_name: row.full_name as string,
      level: row.level as number,
      tenure_months: row.tenure_months as number,
      known: known.has(row.id as string),
    }));
}

/**
 * RULE 1 - rank by familiarity, not distance.
 *
 * Someone the child recognises arriving in fifty minutes beats a stranger
 * arriving in ten. A distance-first sort optimises the metric that is easy to
 * measure; this one optimises the thing the family actually cares about, which
 * is whether their toddler is handed to a face they know. Tenure breaks ties,
 * because longer in the community means more shared context.
 */
export function rankCandidates(candidates: Candidate[]): Candidate[] {
  return [...candidates].sort(
    (a, b) =>
      Number(b.known) - Number(a.known) || b.tenure_months - a.tenure_months,
  );
}

// ---------------------------------------------------------------------------
// Opening a search
// ---------------------------------------------------------------------------

async function sendOffers(
  shiftId: string,
  candidates: Candidate[],
): Promise<void> {
  if (candidates.length === 0) return;

  const admin = createAdminClient();
  const { error } = await admin.from("offers").insert(
    candidates.map((candidate) => ({
      shift_id: shiftId,
      caregiver_id: candidate.id,
      known: candidate.known,
      response: "pending",
    })),
  );

  // A duplicate live offer is caught by uq_offers_one_live_per_caregiver_per_shift.
  // It means dispatch ran twice for the same shift; the offers already exist,
  // so there is nothing to repair and nothing to report.
  if (error && error.code !== "23505") {
    throw new Error(`sendOffers: ${error.message}`);
  }
}

/**
 * RULE 3 - strangers need explicit consent.
 *
 * If nobody the family knows is free, the search stops and asks. It would be
 * trivial to keep the clock happy by quietly offering the shift to whoever is
 * available - the fill-rate metric would look identical, and the product would
 * be gone. A family that opened this app because they trust it will not accept
 * a stranger at the door chosen by software on their behalf. So the engine
 * parks at awaiting_consent and waits for a human to say yes.
 */
export async function openSearch(
  family: Profile,
  shift: Shift,
): Promise<SearchOutcome> {
  const admin = createAdminClient();

  const ranked = rankCandidates(await getEligibleCandidates(family, shift));
  const known = ranked.filter((candidate) => candidate.known);
  const strangers = ranked.filter((candidate) => !candidate.known);

  if (known.length === 0) {
    if (strangers.length === 0) {
      await admin
        .from("shifts")
        .update({ search_status: "unfilled" })
        .eq("id", shift.id);
      return { kind: "nobody_available" };
    }

    await admin
      .from("shifts")
      .update({ search_status: "awaiting_consent" })
      .eq("id", shift.id);
    return { kind: "awaiting_consent", strangersAvailable: strangers.length };
  }

  const offered = known.slice(0, MAX_PARALLEL_OFFERS);
  await sendOffers(shift.id, offered);
  await admin
    .from("shifts")
    .update({ search_status: "open" })
    .eq("id", shift.id);

  return { kind: "offers_sent", offered };
}

/**
 * The parent said yes to strangers. Only now may anyone outside the family's
 * history be asked - this function is the only path to that, which is what
 * makes Rule 3 enforceable rather than aspirational.
 */
export async function offerToStrangers(
  family: Profile,
  shift: Shift,
): Promise<SearchOutcome> {
  const admin = createAdminClient();

  const ranked = rankCandidates(await getEligibleCandidates(family, shift));
  const strangers = ranked.filter((candidate) => !candidate.known);

  if (strangers.length === 0) {
    await admin
      .from("shifts")
      .update({ search_status: "unfilled" })
      .eq("id", shift.id);
    return { kind: "nobody_available" };
  }

  const offered = strangers.slice(0, MAX_PARALLEL_OFFERS);
  await sendOffers(shift.id, offered);
  await admin
    .from("shifts")
    .update({ search_status: "open" })
    .eq("id", shift.id);

  return { kind: "offers_sent", offered };
}

// ---------------------------------------------------------------------------
// Responding
// ---------------------------------------------------------------------------

/**
 * RULE 4 - first accept wins, decided by the database.
 *
 * Three caregivers can tap accept in the same second. This does not resolve
 * that in application code, because every version that does has a window
 * between reading "still open" and writing "mine" in which all three believe
 * they won.
 *
 * Instead the condition and the write are one statement: claim this shift ONLY
 * IF the search is still open. Postgres locks the row, and when the winner
 * commits it re-evaluates the waiting statements against the new version of the
 * row - where search_status is no longer 'open'. Those statements match zero
 * rows and change nothing.
 *
 * So a loser gets a row count of 0, not an exception. "Already filled" is an
 * ordinary answer, never an error, and a double booking cannot be represented.
 */
export async function claimShift(
  shiftId: string,
  caregiverId: string,
): Promise<ClaimOutcome> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("shifts")
    .update({
      caregiver_id: caregiverId,
      search_status: "filled",
      status: "scheduled",
    })
    .eq("id", shiftId)
    .eq("search_status", "open") // <- the entire concurrency story
    .select("id, family_id");

  if (error) throw new Error(`claimShift: ${error.message}`);
  if (!data || data.length === 0) return { kind: "already_filled" };

  // Everything below is the bookkeeping described in the atomicity note at the
  // top of this file: safe to repeat, incapable of double booking.
  const now = new Date().toISOString();

  await admin
    .from("offers")
    .update({ response: "accepted", responded_at: now })
    .eq("shift_id", shiftId)
    .eq("caregiver_id", caregiverId);

  // The losers' cards disappear rather than sitting there offering a shift
  // that is gone.
  await admin
    .from("offers")
    .update({ response: "voided", responded_at: now })
    .eq("shift_id", shiftId)
    .neq("caregiver_id", caregiverId)
    .eq("response", "pending");

  await spendBackupCredit(data[0].family_id as string);

  return { kind: "won" };
}

/** FLOW-07. A covered absence is what the monthly fee buys, so it costs a credit. */
async function spendBackupCredit(familyId: string): Promise<void> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("profiles")
    .select("backup_credits_remaining")
    .eq("id", familyId)
    .maybeSingle();

  const remaining = data?.backup_credits_remaining ?? 0;
  if (remaining <= 0) return; // Never go negative; the column forbids it anyway.

  await admin
    .from("profiles")
    .update({ backup_credits_remaining: remaining - 1 })
    .eq("id", familyId);
}

/**
 * RULE 5 - declining is free.
 *
 * Nothing is scored, ranked down, or remembered against a caregiver who says
 * no. Only the offer's own response changes. A caregiver who is ill, tired or
 * simply busy must be able to say so without it costing her future work,
 * otherwise she stops answering honestly and the whole pool becomes
 * unreliable - which is the exact problem this product exists to solve.
 */
export async function declineOffer(
  offerId: string,
  caregiverId: string,
): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin
    .from("offers")
    .update({ response: "declined", responded_at: new Date().toISOString() })
    .eq("id", offerId)
    .eq("caregiver_id", caregiverId)
    .eq("response", "pending");

  if (error) throw new Error(`declineOffer: ${error.message}`);
}

/**
 * When every caregiver asked has said no, the search is out of people. Marking
 * it unfilled is honest: the parent needs to know to make other arrangements,
 * and a clock still ticking would imply someone is still coming.
 */
export async function closeSearchIfExhausted(shiftId: string): Promise<boolean> {
  const admin = createAdminClient();

  const { data: pending } = await admin
    .from("offers")
    .select("id")
    .eq("shift_id", shiftId)
    .eq("response", "pending");

  if (pending && pending.length > 0) return false;

  const { data } = await admin
    .from("shifts")
    .update({ search_status: "unfilled" })
    .eq("id", shiftId)
    .eq("search_status", "open")
    .select("id");

  return Boolean(data && data.length > 0);
}

// ---------------------------------------------------------------------------
// Reading the search, for the parent's live view
// ---------------------------------------------------------------------------

export type SearchSnapshot = {
  searchStatus: Shift["search_status"];
  status: Shift["status"];
  /**
   * When the search opened, so the clock can tick locally every second between
   * three-second polls. Sending only the elapsed count would make it jump.
   */
  searchOpenedAt: string | null;
  /** FLOW-04. Counts UP: a bar draining over 90 minutes does not visibly move in a demo. */
  elapsedSeconds: number | null;
  budgetSeconds: number;
  /** FLOW-08. Seconds, because "Filled in 0 min" reads as a bug. */
  filledInSeconds: number | null;
  caregiverName: string | null;
  offers: {
    caregiverName: string;
    known: boolean;
    response: Offer["response"];
  }[];
  strangersAvailable: number;
};

export async function getSearchSnapshot(
  family: Profile,
  shift: Shift,
): Promise<SearchSnapshot> {
  const admin = createAdminClient();

  const { data: offerRows } = await admin
    .from("offers")
    .select("known, response, responded_at, caregiver:profiles(full_name)")
    .eq("shift_id", shift.id)
    .order("sent_at");

  // PostgREST types an embed as an array even when the foreign key is to-one,
  // and returns an object at runtime. Accept either rather than cast and hope.
  const embeddedName = (value: unknown): string => {
    const row = Array.isArray(value) ? value[0] : value;
    const name = (row as { full_name?: unknown } | null)?.full_name;
    return typeof name === "string" ? name : "Unknown";
  };

  const offers = (offerRows ?? []).map((row) => ({
    caregiverName: embeddedName(row.caregiver),
    known: row.known as boolean,
    response: row.response as Offer["response"],
  }));

  const openedAt = shift.search_opened_at
    ? new Date(shift.search_opened_at).getTime()
    : null;

  const elapsedSeconds =
    openedAt === null ? null : Math.floor((Date.now() - openedAt) / 1000);

  // Fill time comes from the accepted offer's timestamp rather than a column of
  // its own - the moment she said yes is already recorded.
  const accepted = (offerRows ?? []).find((row) => row.response === "accepted");
  const filledInSeconds =
    openedAt !== null && accepted?.responded_at
      ? Math.max(
          0,
          Math.floor(
            (new Date(accepted.responded_at as string).getTime() - openedAt) /
              1000,
          ),
        )
      : null;

  // Only needed while the parent is being asked to consent, but it is one query
  // and it keeps the consent prompt able to say how many people it means.
  let strangersAvailable = 0;
  if (shift.search_status === "awaiting_consent") {
    const candidates = await getEligibleCandidates(family, shift);
    strangersAvailable = candidates.filter((c) => !c.known).length;
  }

  let caregiverName: string | null = null;
  if (shift.caregiver_id) {
    const { data } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", shift.caregiver_id)
      .maybeSingle();
    caregiverName = (data?.full_name as string | undefined) ?? null;
  }

  return {
    searchStatus: shift.search_status,
    status: shift.status,
    searchOpenedAt: shift.search_opened_at,
    elapsedSeconds,
    budgetSeconds: SEARCH_BUDGET_MINUTES * 60,
    filledInSeconds,
    caregiverName,
    offers,
    strangersAvailable,
  };
}
