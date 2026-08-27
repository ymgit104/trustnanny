"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import {
  claimShift,
  closeSearchIfExhausted,
  declineOffer,
  getSearchSnapshot,
  offerToStrangers,
  openSearch,
  SEARCH_BUDGET_MINUTES,
  type SearchOutcome,
  type SearchSnapshot,
} from "@/lib/dispatch";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Shift } from "@/lib/types";

export type AuthResult = { error: string };
export type ShiftResult = { error: string };

/**
 * Server actions return `{ error }` on failure and redirect on success.
 *
 * `redirect()` works by throwing a control-flow signal that Next catches, so
 * none of these calls may sit inside a try/catch that swallows it - the
 * navigation would be eaten and the user would sit on a form that appears to
 * have done nothing.
 */

function readString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function signIn(formData: FormData): Promise<AuthResult | void> {
  const email = readString(formData, "email");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };

  redirect("/");
}

export async function signUp(formData: FormData): Promise<AuthResult | void> {
  const fullName = readString(formData, "full_name");
  const email = readString(formData, "email");
  const password = String(formData.get("password") ?? "");
  const monthsRaw = readString(formData, "youngest_child_age_months");

  if (!fullName) return { error: "Enter your name." };
  if (!email) return { error: "Enter your email." };
  if (password.length < 6) {
    return { error: "Password needs to be at least 6 characters." };
  }

  const months = Number(monthsRaw);
  if (!monthsRaw || !Number.isInteger(months) || months < 0) {
    return { error: "Enter your youngest child's age in whole months." };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Metadata only. The database trigger on auth.users creates the profile
      // from these keys, so a second insert from here is not just redundant -
      // it can half-fail and leave an account that logs in and then crashes
      // every page. Key names must match the trigger exactly. `role` is
      // omitted on purpose: the trigger coerces anything that is not
      // 'caregiver' to 'parent', and signup is parents only.
      data: {
        full_name: fullName,
        youngest_child_age_months: months,
      },
    },
  });

  if (error) return { error: error.message };

  // No session means email confirmation is still switched on in Supabase.
  // Saying so beats a silent dead end on a form that looks like it worked.
  if (!data.session) {
    return {
      error: "Account created. Check your email to confirm it, then sign in.",
    };
  }

  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---------------------------------------------------------------------------
// Shift CRUD
//
// Every action below resolves the session and checks the role before touching
// anything, and puts family_id inside the query rather than fetching a row and
// comparing afterwards. A shift belonging to another family does not come back
// at all, so there is no window in which the wrong row is in memory.
// ---------------------------------------------------------------------------

type ShiftFields = {
  caregiver_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
};

type Parsed = { ok: true; value: ShiftFields } | { ok: false; error: string };

/** `<input type="time">` submits HH:MM; the column wants HH:MM:SS. */
function normaliseTime(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

async function parseShiftForm(formData: FormData): Promise<Parsed> {
  const shiftDate = readString(formData, "shift_date");
  const startTime = readString(formData, "start_time");
  const endTime = readString(formData, "end_time");
  const caregiverId = readString(formData, "caregiver_id");
  const notes = readString(formData, "notes");

  if (!shiftDate) return { ok: false, error: "Pick a date." };
  if (!startTime || !endTime) {
    return { ok: false, error: "Pick a start and end time." };
  }
  if (normaliseTime(endTime) <= normaliseTime(startTime)) {
    return { ok: false, error: "The end time needs to be after the start time." };
  }
  if (!caregiverId) return { ok: false, error: "Choose a caregiver." };

  // Confirm the caregiver is real and still available, rather than trusting a
  // value that arrived from a form.
  const admin = createAdminClient();
  const { data: caregiver } = await admin
    .from("profiles")
    .select("id")
    .eq("id", caregiverId)
    .eq("role", "caregiver")
    .eq("is_available", true)
    .maybeSingle();

  if (!caregiver) {
    return { ok: false, error: "That caregiver is no longer available." };
  }

  return {
    ok: true,
    value: {
      caregiver_id: caregiverId,
      shift_date: shiftDate,
      start_time: normaliseTime(startTime),
      end_time: normaliseTime(endTime),
      notes: notes || null,
    },
  };
}

/**
 * Turns the constraints defined in schema.sql into sentences a parent can act
 * on. These are real outcomes, not theoretical: the double-booking index fires
 * whenever two families reach for the same caregiver in the same slot.
 */
function describeDbError(error: { code?: string; message: string }): string {
  if (error.code === "23505") {
    return "That caregiver is already booked for another shift at that time.";
  }
  if (error.code === "23514") {
    return "Those times aren't valid for a single day.";
  }
  return error.message;
}

function revalidateShiftViews() {
  revalidatePath("/parent");
  revalidatePath("/parent/shifts");
}

export async function createShift(
  formData: FormData,
): Promise<ShiftResult | void> {
  const profile = await requireRole("parent");

  const parsed = await parseShiftForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const admin = createAdminClient();
  const { error } = await admin.from("shifts").insert({
    family_id: profile.id,
    ...parsed.value,
    status: "scheduled",
    search_status: "none",
  });

  if (error) return { error: describeDbError(error) };

  revalidateShiftViews();
  redirect("/parent/shifts");
}

export async function updateShift(
  shiftId: string,
  formData: FormData,
): Promise<ShiftResult | void> {
  const profile = await requireRole("parent");

  const parsed = await parseShiftForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("shifts")
    .update(parsed.value)
    .eq("id", shiftId)
    .eq("family_id", profile.id)
    .select("id");

  if (error) return { error: describeDbError(error) };
  // Zero rows means the shift is not this family's. Same answer as not found,
  // deliberately - it leaks nothing about other families' data.
  if (!data || data.length === 0) {
    return { error: "That shift could not be found." };
  }

  revalidateShiftViews();
  redirect("/parent/shifts");
}

/**
 * CRUD-04. A soft delete: status becomes 'cancelled' rather than the row
 * disappearing. The schema has that status for a reason, and a family may need
 * to see that a shift existed and was called off.
 */
export async function deleteShift(shiftId: string): Promise<ShiftResult | void> {
  const profile = await requireRole("parent");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("shifts")
    .update({ status: "cancelled", search_status: "none" })
    .eq("id", shiftId)
    .eq("family_id", profile.id)
    .in("status", ["scheduled", "checked_in", "absence_reported"])
    .select("id");

  if (error) return { error: describeDbError(error) };
  if (!data || data.length === 0) {
    return { error: "That shift can no longer be cancelled." };
  }

  revalidateShiftViews();
}

// ---------------------------------------------------------------------------
// The core flow: absence -> search -> accept -> arrival
//
// These actions own permission and ownership. The decisions live in
// dispatch.ts; nothing below chooses who gets offered a shift.
// ---------------------------------------------------------------------------

export type FlowResult = { error: string };

/** Loads a shift the signed-in parent actually owns, or null. */
async function loadOwnShift(
  familyId: string,
  shiftId: string,
): Promise<Shift | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("shifts")
    .select("*")
    .eq("id", shiftId)
    .eq("family_id", familyId)
    .maybeSingle<Shift>();
  return data;
}

/**
 * FLOW-02. One red button, one confirm step, search open within seconds.
 *
 * The status change is a conditional update for the same reason accepting is:
 * a double-tapped absence button would otherwise open two searches and send
 * every caregiver two cards.
 */
export async function reportAbsence(
  shiftId: string,
): Promise<FlowResult | void> {
  const profile = await requireRole("parent");

  const shift = await loadOwnShift(profile.id, shiftId);
  if (!shift) return { error: "That shift could not be found." };

  const openedAt = new Date();
  const deadline = new Date(
    openedAt.getTime() + SEARCH_BUDGET_MINUTES * 60 * 1000,
  );

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("shifts")
    .update({
      status: "absence_reported",
      search_opened_at: openedAt.toISOString(),
      search_deadline_at: deadline.toISOString(),
    })
    .eq("id", shiftId)
    .eq("family_id", profile.id)
    .in("status", ["scheduled", "checked_in"])
    .eq("search_status", "none")
    .select("*")
    .returns<Shift[]>();

  if (error) return { error: describeDbError(error) };
  if (!data || data.length === 0) {
    return { error: "A search is already running for this shift." };
  }

  await openSearch(profile, data[0]);

  revalidateShiftViews();
}

/**
 * FLOW-05. The parent consented to someone the family has not worked with.
 *
 * Guarded on awaiting_consent so consent cannot be replayed onto a search that
 * has already moved on - and so no stranger is ever offered a shift down any
 * other path.
 */
export async function widenSearch(shiftId: string): Promise<FlowResult | void> {
  const profile = await requireRole("parent");

  const shift = await loadOwnShift(profile.id, shiftId);
  if (!shift) return { error: "That shift could not be found." };
  if (shift.search_status !== "awaiting_consent") {
    return { error: "This search has already moved on." };
  }

  const outcome: SearchOutcome = await offerToStrangers(profile, shift);

  revalidateShiftViews();

  if (outcome.kind === "nobody_available") {
    return { error: "Nobody else is free right now." };
  }
}

/**
 * FLOW-06, FLOW-07 and FLOW-10. Accept or decline, from the caregiver's card.
 *
 * Losing a race is not an error here: it returns the plain sentence a caregiver
 * should see, because being second is a normal thing to be.
 */
export async function respondToOffer(
  offerId: string,
  response: "accepted" | "declined",
): Promise<FlowResult | void> {
  const profile = await requireRole("caregiver");

  const admin = createAdminClient();
  const { data: offer } = await admin
    .from("offers")
    .select("id, shift_id, caregiver_id, response")
    .eq("id", offerId)
    .eq("caregiver_id", profile.id)
    .maybeSingle();

  if (!offer) return { error: "That offer could not be found." };
  if (offer.response !== "pending") {
    return { error: "You have already answered this one." };
  }

  if (response === "declined") {
    await declineOffer(offerId, profile.id);
    // Rule 5 means nothing is recorded against her. This only checks whether
    // the search has run out of people to ask.
    await closeSearchIfExhausted(offer.shift_id as string);
    revalidateFlowViews();
    return;
  }

  const outcome = await claimShift(offer.shift_id as string, profile.id);

  revalidateFlowViews();

  if (outcome.kind !== "won") {
    return { error: "This shift has already been filled." };
  }
}

/** FLOW-09. Arrival, which is the whole point of the product. */
export async function checkIn(shiftId: string): Promise<FlowResult | void> {
  const profile = await requireRole("caregiver");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("shifts")
    .update({ status: "checked_in", checkin_at: new Date().toISOString() })
    .eq("id", shiftId)
    .eq("caregiver_id", profile.id)
    .eq("status", "scheduled")
    .select("id");

  if (error) return { error: describeDbError(error) };
  if (!data || data.length === 0) {
    return { error: "That shift is not yours to check in to." };
  }

  revalidateFlowViews();
}

/**
 * FLOW-03. Read for the parent's inline live view, polled every few seconds.
 *
 * Read-only and ownership-scoped, so polling it cannot change anything and
 * cannot see another family's search.
 */
export async function getSearchState(
  shiftId: string,
): Promise<SearchSnapshot | null> {
  const profile = await requireRole("parent");

  const shift = await loadOwnShift(profile.id, shiftId);
  if (!shift) return null;

  return getSearchSnapshot(profile, shift);
}

function revalidateFlowViews() {
  revalidatePath("/parent");
  revalidatePath("/parent/shifts");
  revalidatePath("/caregiver");
}
