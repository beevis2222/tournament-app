-- Review fixes for 20261019000000_schema.sql:
-- 1. Child rows must point at parents in the same club / same event.
-- 2. Staff emails are stored lowercase.
-- 3. Staff rows link to an existing login with the same email.
-- 4. Score log skips no-op updates; signed-in users may only change scores.gross.

-- ---------------------------------------------------------------------------
-- 1. Same-club / same-event checks (security definer so lookups see every row)
-- ---------------------------------------------------------------------------

-- An event's course belongs to the event's club.
create function public.check_event_refs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.course_id is not null and (
    select c.club_id from public.courses c where c.id = new.course_id
  ) is distinct from new.club_id then
    raise exception 'cross_club_reference';
  end if;
  return new;
end;
$$;

create trigger check_event_refs
before insert or update on public.events
for each row execute function public.check_event_refs();

-- An entry's golfer is in the event's club; its tee is on the event's course
-- (or, before the event has a course, on a course of the same club).
create function public.check_entry_refs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ev record;
  tee_course uuid;
begin
  select e.club_id, e.course_id into ev from public.events e where e.id = new.event_id;

  if (select g.club_id from public.golfers g where g.id = new.golfer_id) is distinct from ev.club_id then
    raise exception 'cross_club_reference';
  end if;

  if new.tee_id is not null then
    select t.course_id into tee_course from public.tees t where t.id = new.tee_id;
    if ev.course_id is not null then
      if tee_course is distinct from ev.course_id then
        raise exception 'cross_club_reference';
      end if;
    elsif (select c.club_id from public.courses c where c.id = tee_course) is distinct from ev.club_id then
      raise exception 'cross_club_reference';
    end if;
  end if;

  return new;
end;
$$;

create trigger check_entry_refs
before insert or update on public.entries
for each row execute function public.check_entry_refs();

-- A team member's team and entry are in the same event.
create function public.check_team_member_refs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select t.event_id from public.teams t where t.id = new.team_id)
     is distinct from (select en.event_id from public.entries en where en.id = new.entry_id) then
    raise exception 'cross_event_reference';
  end if;
  return new;
end;
$$;

create trigger check_team_member_refs
before insert or update on public.team_members
for each row execute function public.check_team_member_refs();

-- A group's round and the team placed in it are in the same event.
create function public.check_group_team_refs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select r.event_id from public.groups g join public.rounds r on r.id = g.round_id where g.id = new.group_id)
     is distinct from (select t.event_id from public.teams t where t.id = new.team_id) then
    raise exception 'cross_event_reference';
  end if;
  return new;
end;
$$;

create trigger check_group_team_refs
before insert or update on public.group_teams
for each row execute function public.check_group_team_refs();

-- A score's round and its team (or entry) are in the same event.
create function public.check_score_refs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  round_event uuid;
begin
  select r.event_id into round_event from public.rounds r where r.id = new.round_id;

  if new.team_id is not null
     and (select t.event_id from public.teams t where t.id = new.team_id) is distinct from round_event then
    raise exception 'cross_event_reference';
  end if;

  if new.entry_id is not null
     and (select en.event_id from public.entries en where en.id = new.entry_id) is distinct from round_event then
    raise exception 'cross_event_reference';
  end if;

  return new;
end;
$$;

create trigger check_score_refs
before insert or update on public.scores
for each row execute function public.check_score_refs();

-- ---------------------------------------------------------------------------
-- 2. Staff emails are lowercase
-- ---------------------------------------------------------------------------

update public.staff set email = lower(email) where email <> lower(email);
alter table public.staff add constraint staff_email_lowercase check (email = lower(email));

-- ---------------------------------------------------------------------------
-- 3. Link a staff row to an existing login with the same email
-- ---------------------------------------------------------------------------

create function public.link_staff_to_existing_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is null and new.removed_at is null then
    select u.id into new.user_id
    from auth.users u
    where lower(u.email) = new.email
    limit 1;
  end if;
  return new;
end;
$$;

create trigger link_staff_to_existing_user
before insert or update of email, removed_at on public.staff
for each row execute function public.link_staff_to_existing_user();

-- ---------------------------------------------------------------------------
-- 4. Score log: no rows for no-op updates; only gross can be changed
-- ---------------------------------------------------------------------------

drop trigger log_score on public.scores;

create trigger log_score_insert
after insert on public.scores
for each row execute function public.log_score();

create trigger log_score_update
after update on public.scores
for each row
when (old.gross is distinct from new.gross)
execute function public.log_score();

revoke update on public.scores from authenticated;
grant update (gross) on public.scores to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges for the new trigger functions
-- ---------------------------------------------------------------------------

revoke execute on function public.check_event_refs() from public, anon, authenticated;
revoke execute on function public.check_entry_refs() from public, anon, authenticated;
revoke execute on function public.check_team_member_refs() from public, anon, authenticated;
revoke execute on function public.check_group_team_refs() from public, anon, authenticated;
revoke execute on function public.check_score_refs() from public, anon, authenticated;
revoke execute on function public.link_staff_to_existing_user() from public, anon, authenticated;
