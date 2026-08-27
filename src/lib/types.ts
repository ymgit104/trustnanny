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
