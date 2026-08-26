# TrustNanny — Product Requirements Document (final)

| | |
|---|---|
| **Version** | Final — 1-day build scope |
| **Product** | TrustNanny — childcare continuity |
| **Stack** | Next.js 14 · Supabase · Tailwind · Vercel |
| **Built with** | Claude Code |
| **Budget** | ~9 hours including video |

---

## 1. Summary

TrustNanny sells childcare **continuity**, not childcare discovery. Families
in one gated community pay a flat monthly fee. If their caregiver can't
come, the app finds a replacement the family **already knows** and gets her
to their door within 90 minutes.

The platform takes **zero percent of the caregiver's wage** — families pay
her directly. Revenue is the monthly plan.

**"Childcare that never doesn't show up."**

---

## 2. Problem

Families don't struggle to find a nanny. They struggle with these three
things, in this order:

1. **Absence is unmanaged.** She doesn't arrive, and someone cancels their
   workday. Nothing on the market solves this.
2. **Competence is unchecked.** Nobody has verified she knows what to do if
   the child chokes.
3. **There is no recourse.** No contract, no records, no escalation path.

The problem is **reliability**, not discovery. That reframe is the product.

---

## 3. Goals

### Product goal
Fill a confirmed absence with a caregiver the family already knows, within
90 minutes.

### Assignment goals — every requirement below serves one of these

| Weight | Criterion | How this PRD serves it |
|---|---|---|
| 40% | Works end-to-end | Five screens, three tables, seeded data, no dead buttons |
| 25% | Clarity of video | §10 demo requirements exist purely to make recording clean |
| 20% | Business flow logic | §8, the dispatch spec |
| 15% | Code organisation | §9 conventions, one-file business logic |

---

## 4. Users

**Parent.** Dual-income, young children, flat in a gated community. Opens
the app maybe twice a month. Needs it to work in fifteen seconds under
stress at 7:40am.

**Caregiver.** Works across several families in the same community. Older
Android phone. Wants predictable hours and to not be treated like a tracked
delivery rider.

There is no admin or coordinator role. The dispatch engine replaces them.

---

## 5. Scope

### In scope
Authentication with two roles · shift CRUD · check-in · absence reporting ·
familiarity-ranked dispatch · consent gate for unknown caregivers · offer
accept and decline · live search status with a 90-minute clock · static plan
and insurance fields · seeded demo data · demo reset.

### Out of scope — decisions, not omissions

| Cut | Why |
|---|---|
| Payments, billing, subscriptions | Not needed to demonstrate the loop |
| Admin / coordinator console | The engine does the coordinator's job |
| Caregiver search and browsing | This is not a marketplace. Search is what made v1 a directory. |
| Star ratings | Ranking pressure and legal exposure on a small employed pool, with no matching benefit |
| Live GPS tracking | Worker-dignity problem, tells a parent nothing about her child, and DPDP prohibits monitoring children |
| Check-out | Adds nothing the demo needs; shifts auto-complete |
| Caregiver-reported absence | One entry path is enough |
| Escalation to a second offer wave | Highest bug risk per minute of build time |
| Care record page | Cheap credibility, but not worth a route on this budget |
| Push notifications, websockets | 3-second polling is invisible against a 90-minute clock |
| Offline sync, localisation, incident reporting, training modules, multi-community | Real product needs, wrong budget |

---

## 6. Data model — three tables

```
profiles
  id, role('parent'|'caregiver'), full_name,
  block, flat, plan_tier, backup_credits_remaining,
  youngest_child_age_months,
  level, certifications[], police_verified_on, police_station,
  tenure_months, insurance_policy_no, insurance_valid_to, is_available

shifts                                    ← CORE CRUD ENTITY
  id, family_id, caregiver_id,
  shift_date, start_time, end_time,
  status, checkin_at, notes,
  search_opened_at, search_deadline_at, search_status

  status:        scheduled | checked_in | completed
                 | absence_reported | cancelled
  search_status: none | open | awaiting_consent | filled | unfilled

offers
  id, shift_id, caregiver_id, known(boolean),
  sent_at, response('pending'|'accepted'|'declined'|'voided'), responded_at
```

**No `caregivers` table.** Caregiver fields live on `profiles`, so no query
joins through a second table.

**No `dispatches` table.** Search state lives on the shift. One shift, one
search — one fewer join in every query and one fewer concept to explain.

---

## 7. Functional requirements

### Authentication

| ID | Requirement | Acceptance criteria |
|---|---|---|
| AUTH-01 | Sign up | One page at `/login` with a sign-in / sign-up toggle. Collects name, email, password, youngest child's age in months. |
| AUTH-02 | Profile created by trigger | A database trigger on `auth.users` creates the profile from signup metadata. No second request that can half-fail. |
| AUTH-03 | Log in | Email and password. Lands on `/parent` or `/caregiver` by role. |
| AUTH-04 | Log out | Visible on both dashboards. Returns to `/login`. |
| AUTH-05 | Route protection | Middleware redirects signed-out users to `/login` and signed-in users away from it. |

### Shift CRUD — the core entity

| ID | Requirement | Acceptance criteria |
|---|---|---|
| CRUD-01 | **Create** | Date, start, end, caregiver, notes. Appears in the list immediately. |
| CRUD-02 | **Read** | List view, newest first, showing date, time, caregiver and status. |
| CRUD-03 | **Update** | Edit form reusing the create component. Changes persist. |
| CRUD-04 | **Delete** | Cancel with a confirm step. |
| CRUD-05 | Ownership | Enforced inside the query (`.eq('family_id', profile.id)`), never fetch-then-compare. |

### The core business flow

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FLOW-01 | Late detection | Dashboard shows "hasn't checked in" once the start time has passed with no check-in. |
| FLOW-02 | Absence report | One red button, one confirm step. Opens the search within 5 seconds. |
| FLOW-03 | Live status inline | Rendered on the parent dashboard, not a separate route. Polls every 3 seconds. |
| FLOW-04 | The clock | Counts **up** against a 90:00 budget. |
| FLOW-05 | Consent gate | If nobody known is free, `search_status = awaiting_consent` and the parent is asked before any unknown caregiver is offered. |
| FLOW-06 | Offer card | Caregiver sees family, block and flat, hours, and whether she has worked there before. Accept and decline. |
| FLOW-07 | Accept | Shift reassigns, all other offers void, a backup credit is used, the parent's screen updates without a refresh. |
| FLOW-08 | Fill time | Displayed in seconds under a minute. "Filled in 47 seconds", never "0 min". |
| FLOW-09 | Check in | Single button on the caregiver dashboard. Reflected on the parent dashboard. |
| FLOW-10 | Decline | Free. No score, no penalty, nothing recorded. |

---

## 8. The dispatch specification

This carries the 20%. All of it lives in `src/lib/dispatch.ts`.

### Eligibility
A caregiver may be offered a shift only if **all** hold:
- `is_available` is true
- `level` ≥ the level the youngest child requires
  (< 12 months → 3, < 36 months → 2, otherwise → 1)
- Not already booked in that date and slot
- Not the caregiver who failed to show

### Ranking
Sort by `known` descending, then `tenure_months` descending.

`known` = **has completed at least one shift for this family.** Derived
from a query, never stored. The consequence: the pool of familiar
caregivers grows by itself every time a backup works out, so each emergency
makes the next one easier to fill.

### Offer waves
Offer to up to three known caregivers in parallel. If none are known and
available, pause at `awaiting_consent` and ask the parent. Only after
consent may unknown caregivers be offered.

### State machine

```
scheduled
  → checked_in → completed
  → absence_reported
       search_status = open
          → offers sent to known caregivers
              → accepted   → search_status = filled
              → all declined → search_status = unfilled
       search_status = awaiting_consent   (nobody known was free)
          → parent consents → offers sent → open
```

### Concurrency
Three caregivers can accept at the same instant. The accept is a
**conditional update**: it only matches a shift whose `search_status` is
still `open`. Postgres decides the winner. Losers receive "already filled" —
never an error, never a double booking.

---

## 9. Non-functional requirements

| Area | Requirement |
|---|---|
| Security | RLS enabled on all three tables with **no policies**. The anon key reads nothing. Every server action resolves the session first, then uses a service-role client. Fails closed. |
| Service key | Server-only. Never imported into a client component, never prefixed `NEXT_PUBLIC_`. |
| Storage | No localStorage or sessionStorage anywhere. |
| Fonts | System stacks, not `next/font` with Google Fonts — no build-time network fetch to fail on deploy. |
| Mutations | Server Actions only. No REST layer except the demo reset route. |
| Copy | Sentence case. Buttons name the action: "Schedule shift", not "Submit". Empty states are instructions, not apologies. |
| Type safety | TypeScript strict. `npx tsc --noEmit` clean before every commit. |

---

## 10. Demo requirements

Not polish — these exist so recording doesn't eat your evening.

| ID | Requirement |
|---|---|
| DEMO-01 | `npm run seed` creates one parent, three caregivers, three completed shifts of history, and a shift for today starting **25 minutes ago**, so the no-show flow is armed on first login. |
| DEMO-02 | In-app reset button, gated behind `ENABLE_DEMO_RESET=true`, that re-arms that state in one click. A retake must never need a terminal. |
| DEMO-03 | Seeded familiarity spread: two caregivers with completed shifts for the demo family, one without — so the ranking is visibly doing work. |
| DEMO-04 | All demo accounts use password `demo1234`, printed by the seed script. |

---

## 11. Submission requirements

- [ ] **Loom video, 5–8 minutes**: the idea and problem · how you built it
      (architecture, key decisions) · tools and stack **named specifically**
      — Claude Code, Next.js 14 App Router, Supabase, Vercel, Tailwind
- [ ] **Live app link**, reachable, with **test credentials** in the video
      description and the README
- [ ] **GitHub repo** public, or access granted to **mayanknagpal3107**
- [ ] **README with setup instructions**

---

## 12. What I'd build next

1. Escalation — a second wave of offers when the first all decline
2. A coordinator console for the human who runs a community
3. Real billing with automatic credits when the 90 minutes is missed

---

## The test every requirement passed

> **Does this help a family whose caregiver just didn't show up?**

If not, it's in §5's cut list.
