# TrustNanny

**Childcare that never doesn't show up.**

Live: **https://trustnanny-coral.vercel.app**

---

## The problem

Families don't struggle to find a nanny — they struggle with what happens when
she doesn't arrive, and someone has to cancel their workday at 7:40am. Nothing
on the market solves that: every product in this category is a directory that
helps you search, which is the part families had already worked out. TrustNanny
sells continuity instead of discovery — if your caregiver can't come, it finds a
replacement **you already know** and gets her to your door within 90 minutes.

Not a marketplace. No browsing, no search, no star ratings. The product is what
happens when the caregiver doesn't arrive.

---

## The core flow

```
  Shift scheduled
        │
        ├── caregiver checks in ──────────────► checked_in ──► completed
        │
        └── start time passes, no check-in
                     │
                     ▼
            "She hasn't come"            (parent only, one confirm step)
                     │
                     ▼
            status = absence_reported
            search_status = open              ⏱ 90:00 clock starts, counts UP
                     │
                     ▼
        ┌─── rank eligible caregivers ────────────────────────┐
        │  known  DESC   ← completed a shift for this family  │
        │  tenure DESC   ← tiebreak                           │
        └──────────────────────┬──────────────────────────────┘
                               │
          ┌────────────────────┴────────────────────┐
          │                                         │
   somebody known is free                  nobody known is free
          │                                         │
          ▼                                         ▼
  offer to up to 3 in parallel            search_status = awaiting_consent
  search_status = open                              │
          │                              parent is ASKED before any
          │                              stranger is contacted
          │                                         │
          │                              ┌──────────┴──────────┐
          │                          consents              declines
          │                              │                     │
          │                              ▼                     ▼
          │                    offer to strangers        (search stops)
          │                    search_status = open
          │                              │
          └──────────────┬───────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
  first accept wins               everyone declines
  (conditional UPDATE —           search_status = unfilled
   Postgres picks, not us)
        │
        ▼
  search_status = filled
  shift reassigned · other offers voided · backup credit spent
  parent's screen updates by polling, no refresh
        │
        ▼
  caregiver checks in ──► arrived
```

---

## Test credentials

Password for every account: **`demo1234`**

| Email | Role | Why they exist |
|---|---|---|
| `priya@example.com` | Parent | Priya Reddy, block B flat 804, youngest child 14 months |
| `meera@example.com` | Caregiver | Level 3, 42 months tenure — **known**, ranks first |
| `lakshmi@example.com` | Caregiver | Level 2, 26 months — **known**, and the one who fails to show |
| `anjali@example.com` | Caregiver | Level 2, 8 months — **never worked for Priya**, so the consent gate applies |

Sign in as Priya and the no-show flow is already armed: a shift started 25
minutes ago with no check-in.

Both dashboards carry a demo bar with these credentials and a **Reset demo**
button that re-arms that state in one click, so a retake never needs a terminal.
It only renders when `ENABLE_DEMO_RESET=true`.

---

## Stack

| | |
|---|---|
| Next.js | 14.2.35 (App Router, Server Actions) |
| React | 18.3.1 |
| TypeScript | 5.9.3, strict |
| Tailwind CSS | 3.4.19 |
| Supabase | Postgres + email/password auth · `@supabase/ssr` 0.12.5 · `@supabase/supabase-js` 2.112.4 |
| Node | 22.x (pinned in `engines`) |
| Hosting | Vercel |

Built with Claude Code.

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/ymgit104/trustnanny.git
cd trustnanny
npm install
```

Node 22 is required — `engines.node` pins it so Vercel builds on the same major.

### 2. Create a Supabase project

Then **change two settings**, both of which cost time to discover:

**a. Turn OFF email confirmation.**
Authentication → Sign In / Providers → Email → uncheck **Confirm email**.

With it on, `signUp()` returns a user but no session, so a new account lands
nowhere. Worse, the free tier's built-in SMTP is rate-limited to a handful of
messages an hour — it's explicitly a testing service — so a few demo retakes
will lock you out entirely.

**b. Check "Automatically expose new tables".**
If it is **off** (the default for projects created after May 2026), new tables in
`public` receive **no grants at all — not even to `service_role`.** Grants are a
separate layer from RLS: RLS decides which rows a role sees, grants decide
whether the role may touch the table at all. Without them every server action
fails with a permission error that reads exactly like an RLS bug and is not one.

`supabase/schema.sql` issues the grants explicitly, so it works either way. But
if you ever recreate a table from the dashboard table editor, it comes back
ungranted — re-run the grants, don't touch RLS.

### 3. Environment variables

```bash
cp .env.example .env.local
```

Fill in from Supabase → Project settings → **API Keys**:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-ref.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the `sb_publishable_…` key |
| `SUPABASE_SERVICE_ROLE_KEY` | the `sb_secret_…` key — **server only** |
| `ENABLE_DEMO_RESET` | `true` for the demo, unset otherwise |

Supabase now issues `sb_publishable_…` and `sb_secret_…` keys, replacing the old
`eyJ…` JWTs. Legacy keys still work but are deprecated end of 2026. The variable
names keep the old wording only because renaming them would churn every call
site for no behavioural gain.

The secret key bypasses RLS entirely. It must never be prefixed `NEXT_PUBLIC_`
and never imported into a client component — `src/lib/supabase/admin.ts` opens
with `import "server-only"`, which turns that from a rule into a build error.

### 4. Create the schema

Supabase dashboard → **SQL Editor** → New query → paste all of
[`supabase/schema.sql`](supabase/schema.sql) → Run.

It is re-runnable: `if not exists` throughout, `create or replace` on the
function, `drop trigger if exists` before the trigger.

Then confirm in **Table Editor** that all three tables show **RLS enabled** with
**0 policies**. That is correct, not a mistake — see below.

### 5. Seed the demo data

```bash
npm run seed
```

Creates one parent, three caregivers, three completed shifts of history, and a
shift starting 25 minutes ago. Re-running wipes and rebuilds, so it doubles as a
reset. It prints the credentials when it finishes.

### 6. Run

```bash
npm run dev
```

Open http://localhost:3000 and sign in as `priya@example.com`.

```bash
npm run typecheck   # tsc --noEmit
npm run lint
npm run build
```

> **Don't run `npm run build` while `npm run dev` is running.** Both write to
> `.next`; the build clobbers the dev server's manifest and you get 404ing
> chunks and a page that looks dead but has no errors. This cost an hour.

---

## Data model

Three tables. No `caregivers` table and no `dispatches` table — both are
deliberate.

### `profiles`
One row per account, parent **or** caregiver, created by a database trigger on
`auth.users` from signup metadata. Caregiver fields (`level`, `certifications`,
`police_verified_on`, `tenure_months`, `insurance_*`, `is_available`) live here
too, so no query joins through a second table. Also carries the static
commercial fields — `plan_tier`, `backup_credits_remaining` — which make the
product legible with no billing system behind them.

### `shifts` — the core CRUD entity
`family_id`, `caregiver_id`, `shift_date`, `start_time`, `end_time`, `status`,
`checkin_at`, `notes` — **and the search state**: `search_opened_at`,
`search_deadline_at`, `search_status`.

```
status:        scheduled | checked_in | completed | absence_reported | cancelled
search_status: none | open | awaiting_consent | filled | unfilled
```

### `offers`
One offer to one caregiver: `shift_id`, `caregiver_id`, `known`, `sent_at`,
`response` (`pending | accepted | declined | voided`), `responded_at`.

`known` is snapshotted here only so the offer card can say "you've worked here
before" without re-deriving it. The ranking decision always re-queries.

---

## Key design decisions

### Familiarity beats proximity
Candidates sort by whether they have worked for this family before, then by
tenure. Distance is not a factor. Someone the child recognises arriving in fifty
minutes beats a stranger arriving in ten — a distance-first sort optimises the
metric that's easy to measure rather than the thing the family cares about,
which is whose face their toddler sees.

### "Known" is derived, never stored
It's a query against completed shifts, not a column or a familiarity table.
There is no bookkeeping to keep in step, and the consequence is that the pool of
familiar caregivers **grows by itself** every time a backup works out. Each
emergency makes the next one easier to fill, with nothing to maintain.

### Strangers require explicit consent
If nobody known is free, the search stops at `awaiting_consent` and asks. It
would be trivial to keep the clock happy by quietly offering to whoever is
available — the fill-rate metric would look identical and the product would be
gone. A family that opened this app because they trust it will not accept a
stranger at the door chosen by software on their behalf.

### First accept wins, decided by the database
Three caregivers can tap accept in the same second. This is **not** resolved in
application code, because every version that does has a window between reading
"still open" and writing "mine" in which all three believe they won.

Instead the condition and the write are one statement:

```ts
.update({ caregiver_id, search_status: "filled", status: "scheduled" })
.eq("id", shiftId)
.eq("search_status", "open")   // ← the entire concurrency story
```

Postgres locks the row; when the winner commits it re-evaluates the waiting
statements against the *new* version, where `search_status` is no longer
`open`. Those match zero rows. A loser gets a row count of 0 — not an exception
— so "already filled" is an ordinary answer and a double booking cannot be
represented. Verified with five rounds of three genuinely concurrent accepts:
one winner every time, zero errors.

The bookkeeping *after* a win (marking offers, spending a credit) is not in the
same transaction — Supabase's REST interface has no multi-statement
transactions. That is safe because none of it can cause a double booking and all
of it is idempotent; the worst case is a tidy-up that didn't happen, not a child
left uncovered. Documented in the file rather than hidden.

### Declining is free
No score, no penalty, nothing recorded against a caregiver who says no. There is
no column in the schema that could hold one. A caregiver who can't say no
honestly stops answering honestly, and the whole pool becomes unreliable — which
is the exact problem this product exists to solve.

### Zero commission on caregiver wages
The platform takes **0%** of what a caregiver earns; families pay her directly.
Revenue is the flat monthly plan. Taking a cut would mean the platform profits
more when she is paid less, which is the wrong incentive to build into a product
whose entire value is that workers reliably turn up.

### RLS enabled, no policies attached
All three tables have row-level security on with **zero policies**, so the anon
key reads nothing — the database denies by default. Every read and write goes
through a server action that resolves the session with the publishable key
first, then uses a service-role client for the work.

Writing per-table policies would mean getting nine separate rules right, each
one a chance to leave a door open. No policies means there is no door to leave
open, and there is exactly one way in to secure instead of nine.

### Search state folded onto the shift row
There is no `dispatches` table. One shift, one search. This removes a join from
every query and a concept from every explanation — and it makes "two live
searches on one shift" *unrepresentable* rather than merely forbidden, since
`search_status` is a single column on a single row.

### No GPS tracking
Excluded on principle, not for time. It is a worker-dignity problem, it tells a
parent nothing useful about her child, and India's DPDP rules prohibit
monitoring children.

---

## A bug worth documenting

**Next.js memoises identical GET requests within a single request, and Supabase
queries are GETs.**

The dispatch engine read the list of available caregivers, a caregiver's
availability changed, and a later read in the same request returned the *stale*
list. The symptom: a caregiver marked unavailable was still being offered
shifts. The database was correct the whole time.

This is React's per-request memoisation doing exactly what it's designed to do —
deduplicate identical fetches — which is right for a CMS and wrong for a
database. It was caught by a test asserting Rule 3, which failed because a
stranger got offered a shift before the parent consented. Silent in normal use.

Fixed by giving the admin client a `fetch` that always passes
`cache: "no-store"`, in [`src/lib/supabase/admin.ts`](src/lib/supabase/admin.ts).
Anyone using Supabase from a Next.js Server Component should assume this applies
to them.

---

## Keeping the demo alive

Free Supabase projects **pause after 7 days of inactivity**, and a paused project
does not wake when someone visits — it must be restored by hand from the
dashboard. A grader opening the link a week after submission would find a dead
app.

`GET /api/keep-alive` runs a real `head`-only count against `profiles` and
returns `{ ok, at, profiles }`. It must genuinely reach Postgres; Supabase counts
database activity, not HTTP traffic, so the route is `force-dynamic` and sends
`Cache-Control: no-store`.

[`.github/workflows/keep-alive.yml`](.github/workflows/keep-alive.yml) pings it
Mondays and Thursdays at 06:00 UTC, plus a manual **Run workflow** button. It
needs a repository secret named `APP_URL` (no trailing slash). Two caveats, both
in the file: **cron runs in UTC**, and **GitHub disables scheduled workflows on
repos with no commits for 60 days** — which is precisely the situation a finished
assignment is in.

---

## Deliberately out of scope

These are decisions, not omissions.

| Cut | Why |
|---|---|
| Payments, billing, subscriptions | Not needed to demonstrate the loop |
| Admin / coordinator console | The dispatch engine does the coordinator's job |
| Caregiver search and browsing | This is not a marketplace. Search is what made v1 a directory. |
| Star ratings | Ranking pressure and legal exposure on a small employed pool, with no matching benefit |
| Live GPS tracking | Worker dignity; tells a parent nothing about her child; DPDP prohibits monitoring children |
| Check-out | Adds nothing the demo needs; shifts auto-complete |
| Caregiver-reported absence | One entry path is enough |
| Escalation to a second offer wave | Highest bug risk per minute of build time |
| Care record page | Cheap credibility, not worth a route on this budget |
| Push notifications, websockets | 3-second polling is invisible against a 90-minute clock |
| Offline sync, localisation, incident reporting, training modules, multi-community | Real product needs, wrong budget |

Cancelling a shift is a **soft delete** — `status` becomes `cancelled` rather
than the row disappearing. The schema has that status for a reason, and a family
may need to see that a shift existed and was called off.

---

## What I'd build next

1. **Escalation** — a second wave of offers when the first all decline. Today the
   search goes `unfilled` and tells the parent honestly; it should try harder
   first.
2. **A coordinator console** for the human who runs a community — the one role
   deliberately replaced by the engine, and the first thing a real deployment
   would want back.
3. **Real billing**, with automatic credits when the 90 minutes is missed. The
   promise is only worth what it costs to break.

---

## Project layout

```
src/
  app/
    login/           sign in and sign up on one page, with a toggle
    parent/          dashboard, with the live search rendered inline
    parent/shifts/   list, new, [id] — one shared form component
    caregiver/       offers and check-in, one screen, no navigation
    api/demo/        demo reset       (gated on ENABLE_DEMO_RESET)
    api/keep-alive/  Supabase ping
  lib/
    dispatch.ts      ← all five dispatch rules, one file
    actions.ts       every server action; each resolves session and role first
    auth.ts          session → profile, and the role guards
    queries.ts       reads
    supabase/        browser · session-aware server · service-role admin
    demo-state.mjs   shared by the seed script and the reset route
supabase/schema.sql  three tables, RLS on, no policies, signup trigger
scripts/seed.mjs     npm run seed
```

The whole dispatch policy is in one file on purpose: it should be readable in a
single sitting rather than reconstructed from six modules.
