-- Starter: club data, security, soft delete and score log.
-- Spec: docs/superpowers/specs/2026-10-19-shop-scramble-design.md §2 Data, §3 Logins.
-- Nothing is ever deleted: rows carry deleted_at / removed_at instead.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  user_id uuid null references auth.users (id) on delete set null,
  email text not null,
  role text not null default 'staff' check (role in ('pro', 'staff')),
  invited_at timestamptz not null default now(),
  removed_at timestamptz null,
  created_at timestamptz not null default now(),
  unique (club_id, email)
);
create index staff_user_id_idx on public.staff (user_id);
create index staff_email_idx on public.staff (lower(email));

create table public.golfers (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  name text not null,
  index numeric(4, 1) null,
  nh boolean not null default false,
  ghin_number text null,
  deleted_at timestamptz null,
  created_at timestamptz not null default now()
);
create index golfers_club_id_idx on public.golfers (club_id);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  name text not null,
  pars int[] not null check (cardinality(pars) = 18),
  si int[] not null check (cardinality(si) = 18),
  deleted_at timestamptz null,
  created_at timestamptz not null default now()
);
create index courses_club_id_idx on public.courses (club_id);

create table public.tees (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id),
  name text not null,
  rating numeric(4, 1) not null,
  slope int not null,
  pars int[] null check (pars is null or cardinality(pars) = 18),
  si int[] null check (si is null or cardinality(si) = 18),
  created_at timestamptz not null default now()
);
create index tees_course_id_idx on public.tees (course_id);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id),
  name text not null,
  date date not null,
  format text not null default 'scramble' check (format in ('scramble')),
  status text not null default 'setup' check (status in ('setup', 'live', 'final')),
  course_id uuid null references public.courses (id),
  settings jsonb not null default '{}',
  deleted_at timestamptz null,
  created_at timestamptz not null default now()
);
create index events_club_id_idx on public.events (club_id);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id),
  golfer_id uuid not null references public.golfers (id),
  index_used numeric(4, 1) not null,
  nh boolean not null default false,
  tee_id uuid null references public.tees (id),
  alternate boolean not null default false,
  deleted_at timestamptz null,
  created_at timestamptz not null default now()
);
create index entries_event_id_idx on public.entries (event_id);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id),
  label text not null,
  flight int null,
  status text null check (status in ('WD', 'DQ', 'NS')),
  sort int not null default 0,
  deleted_at timestamptz null,
  created_at timestamptz not null default now()
);
create index teams_event_id_idx on public.teams (event_id);

create table public.team_members (
  team_id uuid not null references public.teams (id),
  entry_id uuid not null references public.entries (id),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  primary key (team_id, entry_id)
);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id),
  number int not null check (number >= 1),
  mode text not null default 'full' check (mode in ('full', 'front', 'back', 'called_off')),
  created_at timestamptz not null default now(),
  unique (event_id, number)
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id),
  start_hole text null,
  start_time text null check (start_time is null or start_time ~ '^\d{2}:\d{2}$'),
  label text not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index groups_round_id_idx on public.groups (round_id);

create table public.group_teams (
  group_id uuid not null references public.groups (id),
  team_id uuid not null references public.teams (id),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  primary key (group_id, team_id)
);

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id),
  team_id uuid null references public.teams (id),
  entry_id uuid null references public.entries (id),
  hole int not null check (hole between 1 and 18),
  gross int null check (gross is null or gross between 1 and 20),
  created_at timestamptz not null default now(),
  check ((team_id is null) <> (entry_id is null))
);
create unique index scores_round_team_hole_key on public.scores (round_id, team_id, hole);
create unique index scores_round_entry_hole_key on public.scores (round_id, entry_id, hole);

create table public.score_log (
  id bigint generated always as identity primary key,
  round_id uuid not null references public.rounds (id),
  team_id uuid null references public.teams (id),
  entry_id uuid null references public.entries (id),
  hole int not null,
  old int null,
  new int null,
  user_id uuid null,
  at timestamptz not null default now(),
  screen text null
);
create index score_log_round_id_idx on public.score_log (round_id);

-- ---------------------------------------------------------------------------
-- Who am I? (security definer so RLS policies can read staff without recursion)
-- ---------------------------------------------------------------------------

create function public.my_club_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.club_id
  from public.staff s
  where s.user_id = auth.uid()
    and s.removed_at is null
$$;

create function public.is_pro(club uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff s
    where s.club_id = club
      and s.user_id = auth.uid()
      and s.role = 'pro'
      and s.removed_at is null
  )
$$;

-- ---------------------------------------------------------------------------
-- First sign-in: create the one club and make the caller its pro.
-- ---------------------------------------------------------------------------

create function public.create_club(name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_club uuid;
  caller_email text;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in';
  end if;

  -- Serialize so two first-time callers can't both create a club.
  lock table public.clubs in exclusive mode;

  if exists (select 1 from public.clubs) then
    raise exception 'club_exists';
  end if;

  select u.email into caller_email from auth.users u where u.id = auth.uid();

  insert into public.clubs (name) values (create_club.name) returning id into new_club;
  insert into public.staff (club_id, user_id, email, role)
  values (new_club, auth.uid(), lower(caller_email), 'pro');

  return new_club;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sign-up is invite-only once a club exists.
-- ---------------------------------------------------------------------------

create function public.guard_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.clubs) then
    return new;
  end if;

  if exists (
    select 1
    from public.staff s
    where lower(s.email) = lower(new.email)
      and s.removed_at is null
  ) then
    return new;
  end if;

  raise exception 'not_invited';
end;
$$;

create trigger guard_signup
before insert on auth.users
for each row execute function public.guard_signup();

create function public.link_staff_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.staff s
  set user_id = new.id
  where lower(s.email) = lower(new.email)
    and s.removed_at is null
    and s.user_id is null;
  return new;
end;
$$;

create trigger link_staff_user
after insert on auth.users
for each row execute function public.link_staff_user();

-- ---------------------------------------------------------------------------
-- Score log: every insert or change to scores, written by the database.
-- ---------------------------------------------------------------------------

create function public.log_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.score_log (round_id, team_id, entry_id, hole, old, new, user_id, at, screen)
  values (
    new.round_id,
    new.team_id,
    new.entry_id,
    new.hole,
    case when tg_op = 'UPDATE' then old.gross end,
    new.gross,
    auth.uid(),
    now(),
    nullif(current_setting('app.screen', true), '')
  );
  return null;
end;
$$;

create trigger log_score
after insert or update on public.scores
for each row execute function public.log_score();

-- Save (or clear, with p_gross null) one team's score on one hole.
-- Runs as the caller, so RLS applies.
create function public.save_score(p_round uuid, p_team uuid, p_hole int, p_gross int, p_screen text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform set_config('app.screen', p_screen, true);
  insert into public.scores (round_id, team_id, hole, gross)
  values (p_round, p_team, p_hole, p_gross)
  on conflict (round_id, team_id, hole) do update set gross = excluded.gross;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security: a user sees and edits only their own club's rows.
-- No delete policies anywhere (soft delete only).
-- ---------------------------------------------------------------------------

alter table public.clubs enable row level security;
alter table public.staff enable row level security;
alter table public.golfers enable row level security;
alter table public.courses enable row level security;
alter table public.tees enable row level security;
alter table public.events enable row level security;
alter table public.entries enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.rounds enable row level security;
alter table public.groups enable row level security;
alter table public.group_teams enable row level security;
alter table public.scores enable row level security;
alter table public.score_log enable row level security;

-- clubs
create policy clubs_select on public.clubs for select to authenticated
  using (id in (select public.my_club_ids()));
create policy clubs_insert on public.clubs for insert to authenticated
  with check (id in (select public.my_club_ids()));
create policy clubs_update on public.clubs for update to authenticated
  using (id in (select public.my_club_ids()))
  with check (id in (select public.my_club_ids()));

-- staff: everyone on staff can see the list; only the pro can invite or remove.
create policy staff_select on public.staff for select to authenticated
  using (club_id in (select public.my_club_ids()));
create policy staff_insert on public.staff for insert to authenticated
  with check (public.is_pro(club_id));
create policy staff_update on public.staff for update to authenticated
  using (public.is_pro(club_id))
  with check (public.is_pro(club_id));

-- Tables with club_id directly.
create policy golfers_select on public.golfers for select to authenticated
  using (club_id in (select public.my_club_ids()));
create policy golfers_insert on public.golfers for insert to authenticated
  with check (club_id in (select public.my_club_ids()));
create policy golfers_update on public.golfers for update to authenticated
  using (club_id in (select public.my_club_ids()))
  with check (club_id in (select public.my_club_ids()));

create policy courses_select on public.courses for select to authenticated
  using (club_id in (select public.my_club_ids()));
create policy courses_insert on public.courses for insert to authenticated
  with check (club_id in (select public.my_club_ids()));
create policy courses_update on public.courses for update to authenticated
  using (club_id in (select public.my_club_ids()))
  with check (club_id in (select public.my_club_ids()));

create policy events_select on public.events for select to authenticated
  using (club_id in (select public.my_club_ids()));
create policy events_insert on public.events for insert to authenticated
  with check (club_id in (select public.my_club_ids()));
create policy events_update on public.events for update to authenticated
  using (club_id in (select public.my_club_ids()))
  with check (club_id in (select public.my_club_ids()));

-- tees -> courses
create policy tees_select on public.tees for select to authenticated
  using (course_id in (select c.id from public.courses c where c.club_id in (select public.my_club_ids())));
create policy tees_insert on public.tees for insert to authenticated
  with check (course_id in (select c.id from public.courses c where c.club_id in (select public.my_club_ids())));
create policy tees_update on public.tees for update to authenticated
  using (course_id in (select c.id from public.courses c where c.club_id in (select public.my_club_ids())))
  with check (course_id in (select c.id from public.courses c where c.club_id in (select public.my_club_ids())));

-- entries, teams, rounds -> events
create policy entries_select on public.entries for select to authenticated
  using (event_id in (select e.id from public.events e where e.club_id in (select public.my_club_ids())));
create policy entries_insert on public.entries for insert to authenticated
  with check (event_id in (select e.id from public.events e where e.club_id in (select public.my_club_ids())));
create policy entries_update on public.entries for update to authenticated
  using (event_id in (select e.id from public.events e where e.club_id in (select public.my_club_ids())))
  with check (event_id in (select e.id from public.events e where e.club_id in (select public.my_club_ids())));

create policy teams_select on public.teams for select to authenticated
  using (event_id in (select e.id from public.events e where e.club_id in (select public.my_club_ids())));
create policy teams_insert on public.teams for insert to authenticated
  with check (event_id in (select e.id from public.events e where e.club_id in (select public.my_club_ids())));
create policy teams_update on public.teams for update to authenticated
  using (event_id in (select e.id from public.events e where e.club_id in (select public.my_club_ids())))
  with check (event_id in (select e.id from public.events e where e.club_id in (select public.my_club_ids())));

create policy rounds_select on public.rounds for select to authenticated
  using (event_id in (select e.id from public.events e where e.club_id in (select public.my_club_ids())));
create policy rounds_insert on public.rounds for insert to authenticated
  with check (event_id in (select e.id from public.events e where e.club_id in (select public.my_club_ids())));
create policy rounds_update on public.rounds for update to authenticated
  using (event_id in (select e.id from public.events e where e.club_id in (select public.my_club_ids())))
  with check (event_id in (select e.id from public.events e where e.club_id in (select public.my_club_ids())));

-- team_members -> teams -> events
create policy team_members_select on public.team_members for select to authenticated
  using (team_id in (select t.id from public.teams t join public.events e on e.id = t.event_id
                     where e.club_id in (select public.my_club_ids())));
create policy team_members_insert on public.team_members for insert to authenticated
  with check (team_id in (select t.id from public.teams t join public.events e on e.id = t.event_id
                          where e.club_id in (select public.my_club_ids())));
create policy team_members_update on public.team_members for update to authenticated
  using (team_id in (select t.id from public.teams t join public.events e on e.id = t.event_id
                     where e.club_id in (select public.my_club_ids())))
  with check (team_id in (select t.id from public.teams t join public.events e on e.id = t.event_id
                          where e.club_id in (select public.my_club_ids())));

-- groups, scores, score_log -> rounds -> events
create policy groups_select on public.groups for select to authenticated
  using (round_id in (select r.id from public.rounds r join public.events e on e.id = r.event_id
                      where e.club_id in (select public.my_club_ids())));
create policy groups_insert on public.groups for insert to authenticated
  with check (round_id in (select r.id from public.rounds r join public.events e on e.id = r.event_id
                           where e.club_id in (select public.my_club_ids())));
create policy groups_update on public.groups for update to authenticated
  using (round_id in (select r.id from public.rounds r join public.events e on e.id = r.event_id
                      where e.club_id in (select public.my_club_ids())))
  with check (round_id in (select r.id from public.rounds r join public.events e on e.id = r.event_id
                           where e.club_id in (select public.my_club_ids())));

create policy scores_select on public.scores for select to authenticated
  using (round_id in (select r.id from public.rounds r join public.events e on e.id = r.event_id
                      where e.club_id in (select public.my_club_ids())));
create policy scores_insert on public.scores for insert to authenticated
  with check (round_id in (select r.id from public.rounds r join public.events e on e.id = r.event_id
                           where e.club_id in (select public.my_club_ids())));
create policy scores_update on public.scores for update to authenticated
  using (round_id in (select r.id from public.rounds r join public.events e on e.id = r.event_id
                      where e.club_id in (select public.my_club_ids())))
  with check (round_id in (select r.id from public.rounds r join public.events e on e.id = r.event_id
                           where e.club_id in (select public.my_club_ids())));

-- score_log: read-only for users; only the log_score trigger writes it.
create policy score_log_select on public.score_log for select to authenticated
  using (round_id in (select r.id from public.rounds r join public.events e on e.id = r.event_id
                      where e.club_id in (select public.my_club_ids())));

-- group_teams -> groups -> rounds -> events
create policy group_teams_select on public.group_teams for select to authenticated
  using (group_id in (select g.id from public.groups g join public.rounds r on r.id = g.round_id
                      join public.events e on e.id = r.event_id
                      where e.club_id in (select public.my_club_ids())));
create policy group_teams_insert on public.group_teams for insert to authenticated
  with check (group_id in (select g.id from public.groups g join public.rounds r on r.id = g.round_id
                           join public.events e on e.id = r.event_id
                           where e.club_id in (select public.my_club_ids())));
create policy group_teams_update on public.group_teams for update to authenticated
  using (group_id in (select g.id from public.groups g join public.rounds r on r.id = g.round_id
                      join public.events e on e.id = r.event_id
                      where e.club_id in (select public.my_club_ids())))
  with check (group_id in (select g.id from public.groups g join public.rounds r on r.id = g.round_id
                           join public.events e on e.id = r.event_id
                           where e.club_id in (select public.my_club_ids())));

-- ---------------------------------------------------------------------------
-- Privileges: signed-out visitors get nothing; nobody can delete or truncate;
-- the score log can only be read.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke delete, truncate on all tables in schema public from authenticated;
revoke insert, update on public.score_log from authenticated;

revoke execute on function public.my_club_ids() from public, anon;
revoke execute on function public.is_pro(uuid) from public, anon;
revoke execute on function public.create_club(text) from public, anon;
revoke execute on function public.save_score(uuid, uuid, int, int, text) from public, anon;
revoke execute on function public.guard_signup() from public, anon, authenticated;
revoke execute on function public.link_staff_user() from public, anon, authenticated;
revoke execute on function public.log_score() from public, anon, authenticated;

grant execute on function public.my_club_ids() to authenticated;
grant execute on function public.is_pro(uuid) to authenticated;
grant execute on function public.create_club(text) to authenticated;
grant execute on function public.save_score(uuid, uuid, int, int, text) to authenticated;
