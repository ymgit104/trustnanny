/**
 * The community's clock.
 *
 * shift_date and start_time are naive columns — "2026-08-28" and "07:30" with
 * no zone attached. Deciding whether that shift has started means choosing a
 * timezone to read them in, and the server's own clock is the wrong choice:
 * locally it is IST, on Vercel it is UTC, so the same row means two different
 * instants depending on where the code happens to run. That is what made the
 * live deployment show a shift starting 25 minutes ago as "Tomorrow".
 *
 * TrustNanny serves one gated community, and multi-community is explicitly out
 * of scope, so the timezone is a fact about the product rather than about the
 * deployment. It is hard-coded here rather than read from the environment: an
 * environment variable implies it could legitimately differ per deploy, and it
 * cannot — a shift booked in this community happens on this community's clock
 * no matter which region the server sits in. (Vercel also reserves the name TZ,
 * so that particular lever does not exist.)
 *
 * If this ever became multi-community, this constant becomes a column on the
 * community row and these helpers take it as an argument. Nothing else changes.
 *
 * Plain .mjs so the seed script under bare Node and the bundled Next app can
 * share one implementation — the same reason demo-state.mjs is .mjs.
 */

export const COMMUNITY_TIMEZONE = "Asia/Kolkata";

const PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: COMMUNITY_TIMEZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const pad = (n) => String(n).padStart(2, "0");

/** The wall-clock reading in the community at a given instant. */
export function communityParts(instant = new Date()) {
  const found = {};
  for (const part of PARTS.formatToParts(instant)) found[part.type] = part.value;
  return {
    year: Number(found.year),
    month: Number(found.month),
    day: Number(found.day),
    hour: Number(found.hour),
    minute: Number(found.minute),
    second: Number(found.second),
  };
}

/** How far ahead of UTC the community is at a given instant, in milliseconds. */
function offsetMs(instantMs) {
  const p = communityParts(new Date(instantMs));
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asIfUtc - instantMs;
}

/** "YYYY-MM-DD" — the community's calendar date at this instant. */
export function communityDate(instant = new Date()) {
  const p = communityParts(instant);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** "HH:MM:00" — the community's wall clock at this instant. */
export function communityTime(instant = new Date()) {
  const p = communityParts(instant);
  return `${pad(p.hour)}:${pad(p.minute)}:00`;
}

/** Today's date in the community. Compare ISO date strings directly — they sort. */
export function communityToday() {
  return communityDate(new Date());
}

/**
 * The real instant at which a stored wall-clock reading occurs.
 *
 * Treats the naive values as UTC, then subtracts the community's offset. The
 * second pass matters only where a zone has DST and the first guess lands on
 * the wrong side of a transition; India has none, but getting it right costs
 * two lines and removes a trap for whoever changes the constant.
 */
export function communityInstant(shiftDate, startTime) {
  const [year, month, day] = shiftDate.split("-").map(Number);
  const [hour, minute] = startTime.split(":").map(Number);

  const naiveAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);

  const firstGuess = naiveAsUtc - offsetMs(naiveAsUtc);
  const corrected = naiveAsUtc - offsetMs(firstGuess);

  return new Date(corrected);
}

/** Whole days between two "YYYY-MM-DD" strings. Both are pure dates, so UTC is safe. */
export function daysBetween(fromDate, toDate) {
  const [fy, fm, fd] = fromDate.split("-").map(Number);
  const [ty, tm, td] = toDate.split("-").map(Number);
  const DAY = 24 * 60 * 60 * 1000;
  return Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / DAY,
  );
}
