import "server-only";

import { shiftStartsAt } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  CaregiverOption,
  PendingOffer,
  ShiftWithCaregiver,
  ShiftWithFamily,
} from "@/lib/types";

// `shifts` has two foreign keys to `profiles`, so the embed names the
// constraint. A bare `profiles(...)` is rejected as ambiguous.
const SHIFT_SELECT = "*, caregiver:profiles!shifts_caregiver_id_fkey(id, full_name)";

/** CRUD-02. Newest first. Ownership is a filter, never a post-hoc comparison. */
export async function listShiftsForFamily(
  familyId: string,
): Promise<ShiftWithCaregiver[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("shifts")
    .select(SHIFT_SELECT)
    .eq("family_id", familyId)
    .order("shift_date", { ascending: false })
    .order("start_time", { ascending: false })
    .returns<ShiftWithCaregiver[]>();

  if (error) throw new Error(`listShiftsForFamily: ${error.message}`);
  return data ?? [];
}

/**
 * CRUD-05. family_id is in the query, so a shift belonging to another family
 * simply does not match - there is nothing fetched to then compare.
 */
export async function getShiftForFamily(
  familyId: string,
  shiftId: string,
): Promise<ShiftWithCaregiver | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("shifts")
    .select(SHIFT_SELECT)
    .eq("id", shiftId)
    .eq("family_id", familyId)
    .maybeSingle<ShiftWithCaregiver>();

  if (error) throw new Error(`getShiftForFamily: ${error.message}`);
  return data;
}

/** The caregiver dropdown. Unavailable caregivers are not offerable, so not pickable. */
export async function listAvailableCaregivers(): Promise<CaregiverOption[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, level, tenure_months")
    .eq("role", "caregiver")
    .eq("is_available", true)
    .order("full_name")
    .returns<CaregiverOption[]>();

  if (error) throw new Error(`listAvailableCaregivers: ${error.message}`);
  return data ?? [];
}

/** The caregiver's own shifts. Cancelled ones are not her problem any more. */
export async function listShiftsForCaregiver(
  caregiverId: string,
): Promise<ShiftWithFamily[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("shifts")
    .select(
      "*, family:profiles!shifts_family_id_fkey(id, full_name, block, flat)",
    )
    .eq("caregiver_id", caregiverId)
    .neq("status", "cancelled")
    .order("shift_date", { ascending: false })
    .order("start_time", { ascending: false })
    .returns<ShiftWithFamily[]>();

  if (error) throw new Error(`listShiftsForCaregiver: ${error.message}`);
  return data ?? [];
}

/**
 * FLOW-06. The offer card needs everything a caregiver weighs before saying
 * yes: which family, where in the community, what hours, and whether she has
 * been there before.
 */
export async function listPendingOffersForCaregiver(
  caregiverId: string,
): Promise<PendingOffer[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("offers")
    .select(
      "id, known, sent_at, shift:shifts(id, shift_date, start_time, end_time, notes, search_status, family:profiles!shifts_family_id_fkey(full_name, block, flat))",
    )
    .eq("caregiver_id", caregiverId)
    .eq("response", "pending")
    .order("sent_at", { ascending: false });

  if (error) throw new Error(`listPendingOffersForCaregiver: ${error.message}`);

  // PostgREST types a to-one embed as an array and returns an object; accept
  // either rather than cast and hope.
  const one = <T>(value: unknown): T | null =>
    (Array.isArray(value) ? value[0] : value) ?? null;

  return (data ?? [])
    .map((row) => {
      const shift = one<{
        id: string;
        shift_date: string;
        start_time: string;
        end_time: string;
        notes: string | null;
        search_status: string;
        family: unknown;
      }>(row.shift);
      if (!shift) return null;

      const family = one<{
        full_name: string;
        block: string | null;
        flat: string | null;
      }>(shift.family);

      return {
        id: row.id as string,
        known: row.known as boolean,
        shiftId: shift.id,
        shiftDate: shift.shift_date,
        startTime: shift.start_time,
        endTime: shift.end_time,
        notes: shift.notes,
        searchStatus: shift.search_status,
        familyName: family?.full_name ?? "A family",
        block: family?.block ?? null,
        flat: family?.flat ?? null,
      } satisfies PendingOffer;
    })
    .filter((offer): offer is PendingOffer => offer !== null)
    // A shift that has since been filled leaves stale cards behind; do not
    // invite a caregiver to accept something that is already gone.
    .filter((offer) => offer.searchStatus === "open");
}

/**
 * The shift the dashboard should be talking about.
 *
 * Deliberately does NOT filter on `shift_date = today`. A shift that started 25
 * minutes ago is dated *yesterday* when the clock reads 00:10, and a strict
 * today filter shows an empty dashboard at exactly the moment the demo needs
 * the no-show flow armed.
 *
 * Instead: the most recent non-cancelled shift that has already started, and if
 * none has, the soonest upcoming one. The date and time are separate columns,
 * so the combined instant is compared here rather than in SQL - at a handful of
 * shifts per family that costs nothing.
 */
export async function getCurrentOrMostRecentShift(
  familyId: string,
): Promise<ShiftWithCaregiver | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("shifts")
    .select(SHIFT_SELECT)
    .eq("family_id", familyId)
    .neq("status", "cancelled")
    .order("shift_date", { ascending: false })
    .order("start_time", { ascending: false })
    .limit(50)
    .returns<ShiftWithCaregiver[]>();

  if (error) throw new Error(`getCurrentOrMostRecentShift: ${error.message}`);
  if (!data || data.length === 0) return null;

  const now = Date.now();
  const started = data.find(
    (shift) => shiftStartsAt(shift.shift_date, shift.start_time).getTime() <= now,
  );

  // Ordered newest first, so the last element is the soonest future shift.
  return started ?? data[data.length - 1];
}
