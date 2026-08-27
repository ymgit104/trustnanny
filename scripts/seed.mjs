/**
 * DEMO-01 / DEMO-02. Seeds the demo community, and doubles as the reset:
 * running it again wipes the demo accounts and rebuilds the same state, so a
 * retake never needs anything but `npm run seed`.
 *
 * Auth users cannot be created from plain SQL, so this goes through
 * auth.admin.createUser with the service-role key. Deleting an auth user
 * cascades to its profile, and from there to shifts and offers, which is what
 * makes the reset a single delete rather than a careful teardown.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PASSWORD = "demo1234";

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

function loadEnvLocal() {
  const env = {};
  let raw;
  try {
    raw = readFileSync(resolve(ROOT, ".env.local"), "utf8");
  } catch {
    throw new Error("No .env.local found. Copy .env.example and fill it in.");
  }
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (match) env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnvLocal();

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!env[key]) throw new Error(`Missing ${key} in .env.local`);
}

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

/** Unwraps a Supabase result, failing loudly with context. */
function must(label, { data, error }) {
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// Dates
//
// shift_date and start_time are naive date/time columns, so everything is
// computed in the machine's local timezone - the demo is watched by a person
// in their own timezone, not in UTC.
// ---------------------------------------------------------------------------

const pad = (n) => String(n).padStart(2, "0");
const isoDate = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isoTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/**
 * end_time must be greater than start_time - they are times of day, not
 * timestamps, so a shift that would run past midnight violates
 * shift_ends_after_it_starts. Clamp rather than wrap.
 */
function endTimeAfter(start, hours) {
  const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
  return isoDate(end) === isoDate(start) ? isoTime(end) : "23:59:00";
}

// ---------------------------------------------------------------------------
// The cast
// ---------------------------------------------------------------------------

const PARENT = {
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

const CAREGIVERS = [
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
    // Known, shorter tenure. She is the one who fails to show, which leaves
    // Meera as the top-ranked replacement.
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

// Left over from manual testing before the seed existed.
const STALE_ACCOUNTS = ["priya.test@example.com"];

// ---------------------------------------------------------------------------
// Wipe
// ---------------------------------------------------------------------------

async function wipe() {
  const emails = new Set([
    PARENT.email,
    ...CAREGIVERS.map((c) => c.email),
    ...STALE_ACCOUNTS,
  ]);

  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`listUsers: ${error.message}`);

  const doomed = data.users.filter((u) => emails.has(u.email ?? ""));

  for (const user of doomed) {
    const { error: delError } = await admin.auth.admin.deleteUser(user.id);
    if (delError) throw new Error(`deleteUser ${user.email}: ${delError.message}`);
  }

  return doomed.length;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Creates the auth user and returns its id. The database trigger builds the
 * profile row from this metadata - nothing here inserts into profiles.
 *
 * email_confirm short-circuits confirmation regardless of the project's email
 * settings, so a seeded account can always sign in.
 */
async function createAccount({ email, full_name, extraMetadata = {} }) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name, ...extraMetadata },
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user.id;
}

async function seedParent() {
  const id = await createAccount({
    email: PARENT.email,
    full_name: PARENT.full_name,
    extraMetadata: {
      youngest_child_age_months: PARENT.profile.youngest_child_age_months,
    },
  });

  must(
    "update parent profile",
    await admin.from("profiles").update(PARENT.profile).eq("id", id).select("id"),
  );

  return id;
}

async function seedCaregiver(caregiver) {
  // No role in the metadata on purpose. The trigger would insert
  // role='caregiver' with a null level, and caregiver_has_level rejects that,
  // failing the whole createUser call. Creating as a parent and promoting in
  // one UPDATE sets role and level together, so the constraint sees a
  // consistent row.
  const id = await createAccount({
    email: caregiver.email,
    full_name: caregiver.full_name,
  });

  must(
    `promote ${caregiver.email} to caregiver`,
    await admin
      .from("profiles")
      .update({ role: "caregiver", ...caregiver.profile })
      .eq("id", id)
      .select("id"),
  );

  return id;
}

// ---------------------------------------------------------------------------
// Shifts
// ---------------------------------------------------------------------------

function historyRows(familyId, caregiverIds) {
  // Three completed shifts. Rule 2 derives "known" from exactly these rows, so
  // this is the entire reason Meera and Lakshmi rank above Anjali.
  const plan = [
    { key: "meera", days: 21 },
    { key: "meera", days: 14 },
    { key: "lakshmi", days: 7 },
  ];

  return plan.map(({ key, days }) => {
    const day = daysAgo(days);
    const checkedIn = new Date(day);
    checkedIn.setHours(9, 2, 0, 0);

    return {
      family_id: familyId,
      caregiver_id: caregiverIds[key],
      shift_date: isoDate(day),
      start_time: "09:00:00",
      end_time: "17:00:00",
      status: "completed",
      checkin_at: checkedIn.toISOString(),
      search_status: "none",
      notes: null,
    };
  });
}

function todayShiftRow(familyId, caregiverIds) {
  // 25 minutes in the past, so the "hasn't checked in" state is already true
  // the moment you sign in and the no-show flow is armed with no waiting.
  const start = new Date(Date.now() - 25 * 60 * 1000);

  return {
    family_id: familyId,
    caregiver_id: caregiverIds.lakshmi,
    shift_date: isoDate(start),
    start_time: isoTime(start),
    end_time: endTimeAfter(start, 8),
    status: "scheduled",
    checkin_at: null,
    search_status: "none",
    notes: "Nap at 1pm. Bottle in the fridge.",
  };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function main() {
  console.log("Seeding TrustNanny demo data\n");

  const removed = await wipe();
  console.log(`  wiped        ${removed} existing account(s)`);

  const familyId = await seedParent();
  console.log(`  parent       ${PARENT.full_name}`);

  const caregiverIds = {};
  for (const caregiver of CAREGIVERS) {
    caregiverIds[caregiver.key] = await seedCaregiver(caregiver);
    console.log(
      `  caregiver    ${caregiver.full_name} (level ${caregiver.profile.level}, ${caregiver.profile.tenure_months} months)`,
    );
  }

  const history = historyRows(familyId, caregiverIds);
  must("insert completed shifts", await admin.from("shifts").insert(history).select("id"));
  console.log(`  history      ${history.length} completed shifts`);

  const today = todayShiftRow(familyId, caregiverIds);
  must("insert today's shift", await admin.from("shifts").insert(today).select("id"));
  console.log(
    `  today        ${today.start_time} on ${today.shift_date}, started 25 minutes ago, not checked in`,
  );

  const known = CAREGIVERS.filter((c) => c.completedShiftsForPriya > 0);
  const unknown = CAREGIVERS.filter((c) => c.completedShiftsForPriya === 0);

  console.log("\nSign in with any of these. Password for all: " + PASSWORD + "\n");
  console.log(`  parent       ${PARENT.email}`);
  for (const caregiver of CAREGIVERS) {
    const tag = caregiver.completedShiftsForPriya > 0 ? "known" : "never worked for Priya";
    console.log(`  caregiver    ${caregiver.email.padEnd(22)} ${tag}`);
  }

  console.log(
    `\nRanking for Priya: ${known.map((c) => c.full_name).join(", ")} rank above ${unknown
      .map((c) => c.full_name)
      .join(", ")}, who needs consent before any offer.`,
  );
  console.log(
    `${CAREGIVERS.find((c) => c.key === "lakshmi").full_name} is on today's shift and has not checked in.`,
  );
}

main().catch((error) => {
  console.error(`\nSeed failed: ${error.message}`);
  process.exit(1);
});
