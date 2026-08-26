# TrustNanny — project brief (1-day build)

Read this before writing any code. It is the source of truth for what this
app is and, more importantly, what it deliberately is not.

## What we're building

TrustNanny is a childcare **continuity** service for a single gated
community. Families pay a flat monthly fee. If their caregiver can't come,
the app finds a replacement the family **already knows** and gets her to
their door within 90 minutes.

Not a marketplace. No browsing, no search, no star ratings. The product is
what happens when the caregiver doesn't arrive.

One-liner: **"Childcare that never doesn't show up."**

## This is a graded assignment with a one-day budget

Three components are mandatory and must all visibly work:

1. **Authentication** — sign up, log in, log out
2. **CRUD** on the core entity — the core entity is `shifts`
3. **Core business flow** — absence → search → accept → arrival

Graded on: works end-to-end (40%), clarity of the video (25%), quality of
the business flow logic (20%), code organisation (15%).

**Five screens that all work beat twelve that half-work.** Every time a
choice appears, take the smaller one.

## Stack

- Next.js 14, App Router, TypeScript strict
- Supabase — Postgres and email/password auth
- Tailwind CSS
- Vercel
- Server Actions for every mutation. No REST layer, no API routes except
  the demo reset.

## Data model — three tables

```
profiles   one row per account, parent OR caregiver. Caregiver fields
           (level, certifications, police_verified_on, tenure_months) live
           here too. Do NOT create a separate caregivers table.

shifts     THE CORE CRUD ENTITY, and it also carries the search state.
           family_id, caregiver_id, shift_date, start_time, end_time,
           status, checkin_at, notes,
           search_opened_at, search_deadline_at, search_status

           status:        scheduled | checked_in | completed |
                          absence_reported | cancelled
           search_status: none | open | awaiting_consent | filled | unfilled

offers     one offer to one caregiver. shift_id, caregiver_id,
           known (boolean), response (pending|accepted|declined|voided)
```

There is deliberately **no dispatches table**. Folding the search state onto
the shift removes a join from every query and a concept from every
explanation. One shift, one search.

## The business logic — this carries 20% of the grade

Put it all in `src/lib/dispatch.ts`, one file, so it can be shown on screen
during the video.

**Rule 1 — rank by familiarity, not distance.**
Sort candidates by whether they have completed a shift for this family
before. Tenure breaks ties. Someone she knows arriving in 50 minutes beats
a stranger arriving in 10.

**Rule 2 — "known" is derived, never stored.**
It is a query against completed shifts. No familiarity table, no
bookkeeping. The pool of familiar caregivers therefore grows on its own
every time a backup works out.

**Rule 3 — strangers need explicit consent.**
If nobody known is free, set `search_status = 'awaiting_consent'` and ask
the parent. Never auto-offer to someone the family has not worked with.
Filling the clock by silently sending a stranger would satisfy the metric
and destroy the product.

**Rule 4 — first accept wins, decided by the database.**
Three caregivers can tap accept at the same moment. The accept is a
conditional update on the shift row with `.eq('search_status', 'open')`.
Losers get a clean "already filled", never an error or a double booking.

**Rule 5 — declining is free.** No score, no penalty, nothing recorded
against a caregiver who says no.

**Eligibility** — offer only to caregivers who are available, certified at
or above the level the youngest child needs (<12 months → 3, <36 months →
2, otherwise 1), and not already booked in that slot.

## Security model

RLS enabled on all three tables with **no policies attached**, so the anon
key reads nothing. All data access goes through server actions that resolve
the session with the anon key first, then use a service-role client for the
work. Fails closed, and it is far less work than per-table policies. Never
import the service-role client into a client component.

## Screens — five, no more

1. `/login` — sign in and sign up on **one page** with a toggle
2. `/parent` — today's shift, check-in state, the absence button, **and the
   live search rendered inline on the same page**
3. `/parent/shifts` — list, with cancel
4. `/parent/shifts/new` and `/parent/shifts/[id]` — one shared form
5. `/caregiver` — my shifts, incoming offers, check in

The live search is deliberately not its own route. Polling it inline means
no navigation, no `[id]` param, and a smoother demo with no page
transitions.

## Cut list — do not build any of this

Separate dispatches table · a dedicated dispatch page · care record page ·
check-out (shifts auto-complete) · caregiver-reported absence (parent
reports only) · escalation to a second wave of offers · payments · billing ·
admin console · incident reporting · training modules · multi-community ·
offline sync · localisation · GPS tracking · star ratings · caregiver
search or browsing · push notifications · websockets · separate signup
route.

Plan tier, backup credits and insurance status are **static fields** on the
profile. They make the product legible with no billing system behind them.

GPS is excluded on principle, not for time: it is a worker-dignity problem,
it tells a parent nothing about her child, and India's DPDP rules prohibit
monitoring children.

## Conventions

- Server actions in `src/lib/actions.ts`. Each one resolves the session and
  checks the caller's role before doing anything.
- Enforce ownership inside the query (`.eq('family_id', profile.id)`), never
  fetch-then-compare.
- System font stacks, not `next/font` with Google Fonts — a build-time font
  fetch is one more way a deploy can fail.
- No localStorage or sessionStorage anywhere.
- Sentence case. Buttons say what happens: "Schedule shift", not "Submit".
- Empty states are instructions, not apologies.
- Times render in monospace with tabular numerals.

## Demo requirements — build these, they are not optional

- **Seed script** (`npm run seed`): one parent, three caregivers, three
  completed shifts of history, and a shift for today starting 25 minutes
  ago — so the no-show flow is armed the moment you sign in.
- **Demo reset button**, gated behind `ENABLE_DEMO_RESET=true`, that
  re-arms that state in one click. A retake must never need a terminal.
- **Fill time shows seconds.** In a live demo the accept lands ~40 seconds
  in. "Filled in 0 min" reads as a bug; "Filled in 47 seconds" reads as the
  win it is.
- **The clock counts up** against a 90-minute budget. A bar depleting over
  90 minutes does not visibly move in a three-minute demo.
