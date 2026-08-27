-- TrustNanny schema. Three tables, no more.
--
-- SECURITY MODEL
-- RLS is enabled on all three tables with NO policies attached. A table with
-- RLS on and zero policies denies every row to every non-bypassing role, so
-- the anon key reads nothing. There is no policy to get subtly wrong, and no
-- door left open by a bug in application code. All reads and writes go through
-- server actions that resolve the session with the anon key first, then use a
-- service-role client for the work. Fails closed.
--
-- GRANTS ARE A SEPARATE LAYER FROM RLS. RLS decides which rows a role sees;
-- grants decide whether the role may touch the table at all. This project was
-- created with "Automatically expose new tables" OFF, which means new public
-- tables receive no grants at all - not even to service_role. The explicit
-- grants near the bottom of this file are therefore load-bearing: without them
-- every server action fails with a permission error that looks like an RLS bug
-- and is not one.
--
-- Deliberately NOT using FORCE ROW LEVEL SECURITY: the signup trigger inserts
-- into profiles as the table owner, and forcing RLS would block it.


-- ---------------------------------------------------------------------------
-- profiles
-- One row per account, parent OR caregiver. Caregiver fields live here too;
-- there is no separate caregivers table, so no query joins through one.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                        uuid primary key references auth.users (id) on delete cascade,
  role                      text        not null default 'parent'
                              check (role in ('parent', 'caregiver')),
  full_name                 text        not null default '',

  -- Where in the community. Shown on the offer card so a caregiver knows where
  -- she is going before she accepts.
  block                     text,
  flat                      text,

  -- Static commercial fields. They make the product legible with no billing
  -- system behind them, which is why they are plain columns and not a table.
  plan_tier                 text        not null default 'standard',
  backup_credits_remaining  integer     not null default 4
                              check (backup_credits_remaining >= 0),

  -- Parent field. Drives the certification level a replacement must hold:
  -- under 12 months -> 3, under 36 months -> 2, otherwise 1.
  youngest_child_age_months integer     check (youngest_child_age_months >= 0),

  -- Caregiver fields.
  level                     integer     check (level between 1 and 3),
  certifications            text[]      not null default '{}',
  police_verified_on        date,
  police_station            text,
  tenure_months             integer     not null default 0
                              check (tenure_months >= 0),
  insurance_policy_no       text,
  insurance_valid_to        date,
  is_available              boolean     not null default true,

  created_at                timestamptz not null default now(),

  -- Eligibility ranking reads level on every dispatch, so a caregiver without
  -- one would be silently unrankable. Enforce it here rather than discover it
  -- at 7:40am.
  constraint caregiver_has_level
    check (role <> 'caregiver' or level is not null)
);


-- ---------------------------------------------------------------------------
-- shifts  <- THE CORE CRUD ENTITY
-- Also carries the search state. One shift, one search: folding search_status
-- onto this row removes a join from every query and a concept from every
-- explanation, and makes "two live searches on one shift" unrepresentable
-- rather than merely forbidden.
-- ---------------------------------------------------------------------------
create table if not exists public.shifts (
  id                 uuid        primary key default gen_random_uuid(),
  family_id          uuid        not null references public.profiles (id) on delete cascade,

  -- Nullable: a shift can sit unassigned while a search is running. On accept
  -- this is reassigned to the winner, so the original no-show is not retained
  -- here - the offers table is the audit trail.
  caregiver_id       uuid        references public.profiles (id) on delete set null,

  shift_date         date        not null,
  start_time         time        not null,
  end_time           time        not null,

  status             text        not null default 'scheduled'
                       check (status in ('scheduled', 'checked_in', 'completed',
                                         'absence_reported', 'cancelled')),
  checkin_at         timestamptz,
  notes              text,

  -- Search state. search_deadline_at is search_opened_at + 90 minutes; the UI
  -- clock counts up toward it, because a bar depleting over 90 minutes does not
  -- visibly move in a three-minute demo.
  search_opened_at   timestamptz,
  search_deadline_at timestamptz,
  search_status      text        not null default 'none'
                       check (search_status in ('none', 'open', 'awaiting_consent',
                                                'filled', 'unfilled')),

  created_at         timestamptz not null default now(),

  constraint shift_ends_after_it_starts check (end_time > start_time)
);


-- ---------------------------------------------------------------------------
-- offers
-- One offer to one caregiver. `known` is snapshotted at send time purely so the
-- offer card can say "you have worked here before" without re-deriving it; the
-- ranking decision itself always re-queries completed shifts.
-- ---------------------------------------------------------------------------
create table if not exists public.offers (
  id           uuid        primary key default gen_random_uuid(),
  shift_id     uuid        not null references public.shifts (id)   on delete cascade,
  caregiver_id uuid        not null references public.profiles (id) on delete cascade,
  known        boolean     not null default false,
  sent_at      timestamptz not null default now(),
  response     text        not null default 'pending'
                 check (response in ('pending', 'accepted', 'declined', 'voided')),
  responded_at timestamptz
);


-- ---------------------------------------------------------------------------
-- Indexes on the columns we actually filter by
-- ---------------------------------------------------------------------------

-- Eligibility sweep: available caregivers at or above a required level, already
-- ordered by the tenure tiebreak.
create index if not exists idx_profiles_eligible_caregivers
  on public.profiles (level desc, tenure_months desc)
  where role = 'caregiver' and is_available;

create index if not exists idx_profiles_role
  on public.profiles (role);

-- Parent's shift list, newest first, ownership enforced inside the query.
create index if not exists idx_shifts_family_date
  on public.shifts (family_id, shift_date desc);

-- Caregiver's own shifts.
create index if not exists idx_shifts_caregiver_date
  on public.shifts (caregiver_id, shift_date desc);

-- RULE 2, the hot path. `known` is derived, never stored: it is this query, run
-- on every dispatch. Partial, so the index holds only completed history.
create index if not exists idx_shifts_known_history
  on public.shifts (family_id, caregiver_id)
  where status = 'completed';

-- The parent dashboard polls live searches every 3 seconds.
create index if not exists idx_shifts_live_search
  on public.shifts (search_status)
  where search_status in ('open', 'awaiting_consent');

create index if not exists idx_shifts_status
  on public.shifts (status);

create index if not exists idx_offers_shift
  on public.offers (shift_id);

-- A caregiver's incoming offers. Partial: nothing ever lists her declined ones.
create index if not exists idx_offers_caregiver_pending
  on public.offers (caregiver_id)
  where response = 'pending';


-- ---------------------------------------------------------------------------
-- Partial unique indexes
--
-- NOTE ON "two live searches per shift": that state cannot be represented.
-- search_status is one column on one shift row, so the data model already
-- guarantees it and no index is needed. These two cover the races that are
-- real. Delete either if you would rather enforce it in application code.
-- ---------------------------------------------------------------------------

-- One live offer per caregiver per shift. Without this, double-clicking
-- "Report absence" or a dispatch retry sends the same caregiver two cards, and
-- she can accept a shift that is already hers.
create unique index if not exists uq_offers_one_live_per_caregiver_per_shift
  on public.offers (shift_id, caregiver_id)
  where response = 'pending';

-- Eligibility says "not already booked in that slot". Enforced here so a
-- concurrent accept cannot double-book a caregiver even if two dispatches race:
-- the database refuses, rather than the application remembering to check.
create unique index if not exists uq_caregiver_not_double_booked
  on public.shifts (caregiver_id, shift_date, start_time)
  where caregiver_id is not null and status in ('scheduled', 'checked_in');


-- ---------------------------------------------------------------------------
-- Row level security: ON everywhere, NO policies anywhere
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.shifts   enable row level security;
alter table public.offers   enable row level security;


-- ---------------------------------------------------------------------------
-- Grants
-- Load-bearing, see the header. service_role bypasses RLS; anon and
-- authenticated are explicitly stripped so the anon key reads nothing even on a
-- project with "Automatically expose new tables" switched back on.
-- ---------------------------------------------------------------------------
revoke all on public.profiles from anon, authenticated;
revoke all on public.shifts   from anon, authenticated;
revoke all on public.offers   from anon, authenticated;

grant usage on schema public to service_role;
grant all on public.profiles to service_role;
grant all on public.shifts   to service_role;
grant all on public.offers   to service_role;


-- ---------------------------------------------------------------------------
-- Signup trigger
-- The profile is created by the database, not by a second request from the
-- client that can half-fail and leave an account with no profile.
--
-- security definer so it can write to profiles under RLS; search_path pinned
-- empty so a caller cannot shadow `profiles` with their own table, which is the
-- standard privilege-escalation route against a definer function. Every name
-- below is therefore fully qualified.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  insert into public.profiles (id, role, full_name, youngest_child_age_months)
  values (
    new.id,
    -- Anything other than an explicit 'caregiver' becomes a parent. Signup
    -- collects a child's age, so signup means parent; caregivers are seeded.
    -- Coercing rather than rejecting means a malformed metadata payload cannot
    -- fail the whole signup.
    case when new.raw_user_meta_data ->> 'role' = 'caregiver'
         then 'caregiver' else 'parent' end,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'youngest_child_age_months', '')::integer
  );
  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
