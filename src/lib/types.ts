export type Role = "parent" | "caregiver";

/**
 * One row of `profiles`. Parent and caregiver share the table, so the fields
 * belonging to the other role are simply null - there is no caregivers table
 * to join through.
 */
export type Profile = {
  id: string;
  role: Role;
  full_name: string;

  block: string | null;
  flat: string | null;

  plan_tier: string;
  backup_credits_remaining: number;

  // Parent field. Drives the level a replacement must hold.
  youngest_child_age_months: number | null;

  // Caregiver fields.
  level: number | null;
  certifications: string[];
  police_verified_on: string | null;
  police_station: string | null;
  tenure_months: number;
  insurance_policy_no: string | null;
  insurance_valid_to: string | null;
  is_available: boolean;

  created_at: string;
};

export type ShiftStatus =
  | "scheduled"
  | "checked_in"
  | "completed"
  | "absence_reported"
  | "cancelled";

export type SearchStatus =
  | "none"
  | "open"
  | "awaiting_consent"
  | "filled"
  | "unfilled";

/** One row of `shifts`. Carries its own search state - there is no dispatches table. */
export type Shift = {
  id: string;
  family_id: string;
  caregiver_id: string | null;
  shift_date: string;
  start_time: string;
  end_time: string;
  status: ShiftStatus;
  checkin_at: string | null;
  notes: string | null;
  search_opened_at: string | null;
  search_deadline_at: string | null;
  search_status: SearchStatus;
  created_at: string;
};

/**
 * A shift with its caregiver's name resolved. `shifts` has two foreign keys to
 * `profiles`, so the embed must name the constraint or PostgREST refuses it as
 * ambiguous.
 */
export type ShiftWithCaregiver = Shift & {
  caregiver: { id: string; full_name: string } | null;
};

export type OfferResponse = "pending" | "accepted" | "declined" | "voided";

/**
 * One offer to one caregiver. `known` is snapshotted here only so the offer
 * card can say "you have worked here before" without re-deriving it; the
 * ranking decision itself always re-queries completed shifts.
 */
export type Offer = {
  id: string;
  shift_id: string;
  caregiver_id: string;
  known: boolean;
  sent_at: string;
  response: OfferResponse;
  responded_at: string | null;
};

export type ShiftWithFamily = Shift & {
  family: {
    id: string;
    full_name: string;
    block: string | null;
    flat: string | null;
  } | null;
};

/** Everything the caregiver's offer card shows, flattened for rendering. */
export type PendingOffer = {
  id: string;
  known: boolean;
  shiftId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  notes: string | null;
  searchStatus: string;
  familyName: string;
  block: string | null;
  flat: string | null;
};

export type CaregiverOption = {
  id: string;
  full_name: string;
  level: number | null;
  tenure_months: number;
};
