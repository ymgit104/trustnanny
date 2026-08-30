import {
  communityDate,
  communityInstant,
  communityTime,
} from "./community-time.mjs";

/**
 * The demo's definition of "armed", shared by `npm run seed` and the in-app
 * reset route so the two can never drift apart.
 *
 * Plain .mjs rather than TypeScript because the seed script runs under bare
 * Node with no build step, while the route is bundled by Next. This is the one
 * module both can import.
 *
 * Deliberately takes a Supabase client as an argument and reads no environment
 * itself: the script loads .env.local from disk, the route reads process.env on
 * Vercel, and neither concern belongs here.
 */

export const DEMO_PASSWORD = "demo1234";

// ---------------------------------------------------------------------------
// Dates
//
// shift_date and start_time are naive columns, so every value written here is
// the community's wall clock - not the clock of whichever machine ran the seed.
// Without that, a shift seeded from a laptop in IST reads five and a half hours
// adrift on a Vercel server running UTC, and "started 25 minutes ago" becomes
// "starts tomorrow".
// ---------------------------------------------------------------------------

export function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

/**
 * end_time must be greater than start_time, and they are times of day rather
 * than timestamps, so a shift running past midnight would violate
 * shift_ends_after_it_starts. Clamp rather than wrap - judged on the community's
 * calendar, since that is whose midnight the columns mean.
 */
export function endTimeAfter(start, hours) {
  const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
  return communityDate(end) === communityDate(start)
    ? communityTime(end)
    : "23:59:00";
}

// ---------------------------------------------------------------------------
// The cast
// ---------------------------------------------------------------------------

export const PARENT = {
  email: "priya@example.com",
  full_name: "Priya Reddy",
  profile: {
    block: "B",
    flat: "804",
    plan_tier: "standard",
    backup_credits_remaining: 4,
    // Under 36 months, so a replacement must be level 2 or above. Every
    // caregiver below clears that bar, or the demo search would find nobody.
    youngest_child_age_months: 14,
    // Static, like plan_tier: the dashboard's insurance card reads a real
    // column rather than printing a hardcoded word.
    insurance_policy_no: "TN-FAM-11204",
    insurance_valid_to: "2027-08-31",
  },
};

export const CAREGIVERS = [
  {
    key: "meera",
    email: "meera@example.com",
    full_name: "Meera Pillai",
    // Known, and the longest tenure, so she ranks first for Priya.
    completedShiftsForPriya: 2,
    profile: {
      level: 3,
      certifications: ["Infant CPR", "Paediatric first aid", "Newborn care"],
      police_verified_on: "2025-11-14",
      police_station: "Kondapur",
      tenure_months: 42,
      insurance_policy_no: "TN-INS-40221",
      insurance_valid_to: "2027-03-31",
      is_available: true,
    },
  },
  {
    key: "lakshmi",
    email: "lakshmi@example.com",
    full_name: "Lakshmi Devi",
    completedShiftsForPriya: 1,
    profile: {
      level: 2,
      certifications: ["Infant CPR", "Paediatric first aid"],
      police_verified_on: "2026-01-22",
      police_station: "Gachibowli",
      tenure_months: 26,
      insurance_policy_no: "TN-INS-40588",
      insurance_valid_to: "2027-01-31",
      is_available: true,
    },
  },
  {
    key: "anjali",
    email: "anjali@example.com",
    full_name: "Anjali Menon",
    // DEMO-03: eligible but never worked for Priya, so ranking visibly sorts
    // her below the known two and the consent gate applies to her.
    completedShiftsForPriya: 0,
    profile: {
      level: 2,
      certifications: ["Paediatric first aid"],
      police_verified_on: "2026-05-09",
      police_station: "Madhapur",
      tenure_months: 8,
      insurance_policy_no: "TN-INS-41903",
      insurance_valid_to: "2027-06-30",
      is_available: true,
    },
  },
];

/**
 * Whoever fails to show. Known, but not the highest tenure, so the search that
 * follows has a *better* known caregiver to find - which is what makes the
 * familiarity ranking visible rather than theoretical.
 */
export const NO_SHOW_KEY = "lakshmi";

export const SHIFT_NOTES = "Nap at 1pm. Bottle in the fridge.";

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

/** Three completed shifts. Rule 2 derives "known" from exactly these rows. */
export function buildHistoryRows(familyId, caregiverIds) {
  const plan = [
    { key: "meera", days: 21 },
    { key: "meera", days: 14 },
    { key: "lakshmi", days: 7 },
  ];

  return plan.map(({ key, days }) => {
    const day = daysAgo(days);
    // checkin_at is a timestamptz - a real instant - so it is derived from the
    // community's 09:02 on that day rather than the server's.
    const checkedIn = communityInstant(communityDate(day), "09:02");

    return {
      family_id: familyId,
      caregiver_id: caregiverIds[key],
      shift_date: communityDate(day),
      start_time: "09:00:00",
      end_time: "17:00:00",
      status: "completed",
      checkin_at: checkedIn.toISOString(),
      search_status: "none",
      notes: null,
    };
  });
}

/**
 * DEMO-01. Twenty-five minutes in the past, so "hasn't checked in" is already
 * true the moment you sign in and the no-show flow is armed with no waiting.
 */
export function buildArmedShiftRow(familyId, caregiverId) {
  const start = new Date(Date.now() - 25 * 60 * 1000);

  return {
    family_id: familyId,
    caregiver_id: caregiverId,
    shift_date: communityDate(start),
    start_time: communityTime(start),
    end_time: endTimeAfter(start, 8),
    status: "scheduled",
    checkin_at: null,
    search_status: "none",
    notes: SHIFT_NOTES,
  };
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

/**
 * DEMO-02. Puts the community back to the armed state without touching the
 * accounts, so a retake never needs a terminal.
 *
 * Completed history is left alone on purpose: it is what makes two caregivers
 * "known", and deleting it would quietly disarm the ranking the demo is meant
 * to show.
 */
export async function resetToArmedState(admin) {
  const { data: parent } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "parent")
    .eq("full_name", PARENT.full_name)
    .maybeSingle();

  if (!parent) {
    return {
      ok: false,
      message: "Demo accounts are missing. Run npm run seed once first.",
    };
  }

  const { data: caregivers } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("role", "caregiver");

  const noShowName = CAREGIVERS.find((c) => c.key === NO_SHOW_KEY).full_name;
  const noShow = (caregivers ?? []).find((c) => c.full_name === noShowName);

  if (!noShow) {
    return {
      ok: false,
      message: "Demo caregivers are missing. Run npm run seed once first.",
    };
  }

  // Offers hang off shifts, and the shifts about to be deleted would cascade
  // anyway - but a demo may also have left offers on history rows.
  const { data: familyShifts } = await admin
    .from("shifts")
    .select("id")
    .eq("family_id", parent.id);

  const shiftIds = (familyShifts ?? []).map((s) => s.id);
  if (shiftIds.length > 0) {
    await admin.from("offers").delete().in("shift_id", shiftIds);
  }

  // Everything except the completed history.
  await admin
    .from("shifts")
    .delete()
    .eq("family_id", parent.id)
    .neq("status", "completed");

  await admin
    .from("profiles")
    .update({
      backup_credits_remaining: PARENT.profile.backup_credits_remaining,
    })
    .eq("id", parent.id);

  // A previous run may have toggled someone off to demonstrate the consent gate.
  await admin
    .from("profiles")
    .update({ is_available: true })
    .eq("role", "caregiver");

  const armed = buildArmedShiftRow(parent.id, noShow.id);
  const { error } = await admin.from("shifts").insert(armed);

  if (error) return { ok: false, message: error.message };

  return {
    ok: true,
    message: `Armed: ${noShowName} is on a shift that started 25 minutes ago and has not checked in.`,
    shift: { date: armed.shift_date, startTime: armed.start_time },
  };
}
