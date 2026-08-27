/**
 * DEMO-01. Seeds the demo community from scratch: accounts, history, and the
 * armed shift.
 *
 * The definition of the demo itself lives in src/lib/demo-state.mjs, shared
 * with the in-app reset route so the two cannot drift. This file owns only what
 * the route cannot do: creating auth users, which is impossible from plain SQL
 * and needs the service-role key.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  buildArmedShiftRow,
  buildHistoryRows,
  CAREGIVERS,
  DEMO_PASSWORD,
  NO_SHOW_KEY,
  PARENT,
} from "../src/lib/demo-state.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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

function must(label, { data, error }) {
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

// Left over from manual testing before the seed existed.
const STALE_ACCOUNTS = ["priya.test@example.com", "other.family@example.com"];

// ---------------------------------------------------------------------------
// Wipe
//
// Deleting an auth user cascades to its profile, and from there to shifts and
// offers, which is what makes the reset a single delete rather than a careful
// teardown.
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
    if (delError)
      throw new Error(`deleteUser ${user.email}: ${delError.message}`);
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
    password: DEMO_PASSWORD,
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
    await admin
      .from("profiles")
      .update(PARENT.profile)
      .eq("id", id)
      .select("id"),
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

  const history = buildHistoryRows(familyId, caregiverIds);
  must(
    "insert completed shifts",
    await admin.from("shifts").insert(history).select("id"),
  );
  console.log(`  history      ${history.length} completed shifts`);

  const today = buildArmedShiftRow(familyId, caregiverIds[NO_SHOW_KEY]);
  must(
    "insert today's shift",
    await admin.from("shifts").insert(today).select("id"),
  );
  console.log(
    `  today        ${today.start_time} on ${today.shift_date}, started 25 minutes ago, not checked in`,
  );

  const known = CAREGIVERS.filter((c) => c.completedShiftsForPriya > 0);
  const unknown = CAREGIVERS.filter((c) => c.completedShiftsForPriya === 0);
  const noShow = CAREGIVERS.find((c) => c.key === NO_SHOW_KEY);

  console.log(
    `\nSign in with any of these. Password for all: ${DEMO_PASSWORD}\n`,
  );
  console.log(`  parent       ${PARENT.email}`);
  for (const caregiver of CAREGIVERS) {
    const tag =
      caregiver.completedShiftsForPriya > 0
        ? "known"
        : "never worked for Priya";
    console.log(`  caregiver    ${caregiver.email.padEnd(22)} ${tag}`);
  }

  console.log(
    `\nRanking for Priya: ${known.map((c) => c.full_name).join(", ")} rank above ${unknown
      .map((c) => c.full_name)
      .join(", ")}, who needs consent before any offer.`,
  );
  console.log(
    `${noShow.full_name} is on today's shift and has not checked in.`,
  );
}

main().catch((error) => {
  console.error(`\nSeed failed: ${error.message}`);
  process.exit(1);
});
