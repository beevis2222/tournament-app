-- pgTAP checks for the database schema (web/supabase/migrations).
--
-- Run it ONLY against the empty test project (starter-test), never production:
--   With Docker:    cd web && npx supabase test db --linked     (linked to starter-test)
--   Without Docker: cd web && node supabase/tests/run-on-test-project.mjs
--     (wraps this file and runs it on starter-test through `supabase db query`;
--      needs only `npx supabase login`)
--
-- Everything runs in one transaction and is rolled back, so the database is left untouched.
-- Sign-up is open only while no clubs exist, so the file refuses to run if any club exists.
begin;

do $$
begin
  if exists (select 1 from public.clubs) then
    raise exception 'schema.test.sql must run on the empty test project: clubs exist here (is this production?)';
  end if;
end;
$$;

create extension if not exists pgtap with schema extensions;

select plan(44);

-- Fixed ids for readability.
--   user A  ...-0000-00000000000a  pro of club A (made through create_club)
--   user B  ...-0000-00000000000b  staff (not pro) of club B, invited
--   club B  ...-0000-0000000000cb
--   events  ...-0000-0000000000ea (club A), ...-0000-0000000000eb (club B)
--   club A: team a1, round a2, group a3 (in -0000-), course/tee/golfer -0001/-0002/-0003-..0a
--   club B: course/tee/golfer -0001/-0002/-0003-..0b, entry -0004-..0b, team -0005-..0b, round -0006-..0b

-- ===========================================================================
-- Sign-up and club creation
-- ===========================================================================

select lives_ok(
  $$insert into auth.users (id, email, aud, role)
    values ('00000000-0000-0000-0000-00000000000a', 'a@starter.test', 'authenticated', 'authenticated')$$,
  'first user can sign up while there are no clubs'
);

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
set local role authenticated;

select ok(public.create_club('Club A') is not null, 'create_club returns the new club id');
select ok(
  (select role = 'pro' and email = 'a@starter.test' from public.staff where user_id = '00000000-0000-0000-0000-00000000000a'),
  'create_club makes the caller pro, with their email'
);
select throws_ok($$select public.create_club('Club B')$$, 'P0001', 'club_exists', 'create_club raises club_exists the second time');

reset role;

-- Club B with an invited staff member (set up directly, as the database owner).
insert into public.clubs (id, name) values ('00000000-0000-0000-0000-0000000000cb', 'Club B');
insert into public.staff (club_id, email, role) values ('00000000-0000-0000-0000-0000000000cb', 'b@starter.test', 'staff');

select throws_ok(
  $$insert into auth.users (id, email, aud, role)
    values ('00000000-0000-0000-0000-0000000000ff', 'stranger@starter.test', 'authenticated', 'authenticated')$$,
  'P0001', 'not_invited', 'guard_signup refuses an email that is not on staff'
);
select lives_ok(
  $$insert into auth.users (id, email, aud, role)
    values ('00000000-0000-0000-0000-00000000000b', 'B@Starter.test', 'authenticated', 'authenticated')$$,
  'an invited email can sign up (any case)'
);
select is(
  (select user_id from public.staff where email = 'b@starter.test'),
  '00000000-0000-0000-0000-00000000000b'::uuid,
  'sign-up links the staff row to the new user'
);

-- ===========================================================================
-- Fixtures (as the database owner)
-- ===========================================================================

insert into public.courses (id, club_id, name, pars, si)
select '00000000-0000-0000-0001-00000000000a', c.id, 'A course', array_fill(4, array[18]), array_fill(1, array[18])
from public.clubs c where c.name = 'Club A';
insert into public.courses (id, club_id, name, pars, si)
values ('00000000-0000-0000-0001-00000000000b', '00000000-0000-0000-0000-0000000000cb', 'B course', array_fill(4, array[18]), array_fill(1, array[18]));
insert into public.tees (id, course_id, name, rating, slope) values
  ('00000000-0000-0000-0002-00000000000a', '00000000-0000-0000-0001-00000000000a', 'White', 70.1, 125),
  ('00000000-0000-0000-0002-00000000000b', '00000000-0000-0000-0001-00000000000b', 'White', 70.1, 125);
insert into public.golfers (id, club_id, name, index)
select '00000000-0000-0000-0003-00000000000a', c.id, 'Golfer A', 10.2 from public.clubs c where c.name = 'Club A';
insert into public.golfers (id, club_id, name, index)
values ('00000000-0000-0000-0003-00000000000b', '00000000-0000-0000-0000-0000000000cb', 'Golfer B', 8.4);

insert into public.events (id, club_id, name, date, course_id)
select '00000000-0000-0000-0000-0000000000ea', c.id, 'A event', date '2026-10-19', '00000000-0000-0000-0001-00000000000a'
from public.clubs c where c.name = 'Club A';
insert into public.events (id, club_id, name, date, course_id)
values ('00000000-0000-0000-0000-0000000000eb', '00000000-0000-0000-0000-0000000000cb', 'B event', date '2026-10-19',
        '00000000-0000-0000-0001-00000000000b');

insert into public.teams (id, event_id, label) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000ea', 'Team 1'),
  ('00000000-0000-0000-0005-00000000000b', '00000000-0000-0000-0000-0000000000eb', 'Team 1');
insert into public.rounds (id, event_id, number) values
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000ea', 1),
  ('00000000-0000-0000-0006-00000000000b', '00000000-0000-0000-0000-0000000000eb', 1);
insert into public.groups (id, round_id, label) values
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a2', 'Group 1');
insert into public.entries (id, event_id, golfer_id, index_used, tee_id)
values ('00000000-0000-0000-0004-00000000000b', '00000000-0000-0000-0000-0000000000eb', '00000000-0000-0000-0003-00000000000b',
        8.4, '00000000-0000-0000-0002-00000000000b');

-- Club B has its own score (and so its own score_log row).
insert into public.scores (round_id, team_id, hole, gross)
values ('00000000-0000-0000-0006-00000000000b', '00000000-0000-0000-0005-00000000000b', 1, 3);

-- ===========================================================================
-- As user A (pro of club A)
-- ===========================================================================

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
set local role authenticated;

-- Club isolation.
select is((select count(*)::int from public.events where id = '00000000-0000-0000-0000-0000000000ea'), 1, 'user A sees their own club''s event');
select is((select count(*)::int from public.events where id = '00000000-0000-0000-0000-0000000000eb'), 0, 'user A cannot see club B''s event');
select throws_ok(
  $$insert into public.events (club_id, name, date) values ('00000000-0000-0000-0000-0000000000cb', 'sneaky', date '2026-10-19')$$,
  '42501', null, 'user A cannot add an event to club B'
);
select throws_ok(
  $$update public.events set club_id = '00000000-0000-0000-0000-0000000000cb', course_id = null where id = '00000000-0000-0000-0000-0000000000ea'$$,
  '42501', null, 'user A cannot move their event into club B'
);
select throws_ok(
  $$insert into public.staff (club_id, email) values ('00000000-0000-0000-0000-0000000000cb', 'x@starter.test')$$,
  '42501', null, 'a pro cannot add staff to another club'
);
select throws_ok($$delete from public.events$$, '42501', null, 'delete from events is refused for staff');

-- Cross-parent references are refused.
select throws_ok(
  $$insert into public.events (club_id, name, date, course_id)
    select club_id, 'bad course', date '2026-10-19', '00000000-0000-0000-0001-00000000000b'
    from public.events where id = '00000000-0000-0000-0000-0000000000ea'$$,
  'P0001', 'cross_club_reference', 'an event cannot use another club''s course'
);
select throws_ok(
  $$update public.events set course_id = '00000000-0000-0000-0001-00000000000b' where id = '00000000-0000-0000-0000-0000000000ea'$$,
  'P0001', 'cross_club_reference', 'an event cannot be switched to another club''s course'
);
select throws_ok(
  $$insert into public.entries (event_id, golfer_id, index_used)
    values ('00000000-0000-0000-0000-0000000000ea', '00000000-0000-0000-0003-00000000000b', 8.4)$$,
  'P0001', 'cross_club_reference', 'an entry cannot use another club''s golfer'
);
select throws_ok(
  $$insert into public.entries (event_id, golfer_id, index_used, tee_id)
    values ('00000000-0000-0000-0000-0000000000ea', '00000000-0000-0000-0003-00000000000a', 10.2, '00000000-0000-0000-0002-00000000000b')$$,
  'P0001', 'cross_club_reference', 'an entry cannot use a tee from another course'
);
select lives_ok(
  $$insert into public.entries (id, event_id, golfer_id, index_used, tee_id)
    values ('00000000-0000-0000-0004-00000000000a', '00000000-0000-0000-0000-0000000000ea',
            '00000000-0000-0000-0003-00000000000a', 10.2, '00000000-0000-0000-0002-00000000000a')$$,
  'an entry with the club''s own golfer and tee is accepted'
);
select throws_ok(
  $$insert into public.team_members (team_id, entry_id)
    values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0004-00000000000b')$$,
  'P0001', 'cross_event_reference', 'a team cannot include an entry from another event'
);
select lives_ok(
  $$insert into public.team_members (team_id, entry_id)
    values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0004-00000000000a')$$,
  'a team can include an entry from its own event'
);
select throws_ok(
  $$insert into public.group_teams (group_id, team_id)
    values ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0005-00000000000b')$$,
  'P0001', 'cross_event_reference', 'a group cannot hold a team from another event'
);
select lives_ok(
  $$insert into public.group_teams (group_id, team_id)
    values ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a1')$$,
  'a group can hold a team from its own event'
);
select throws_ok(
  $$select public.save_score('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0005-00000000000b', 1, 4, 'cards')$$,
  'P0001', 'cross_event_reference', 'a score cannot pair a round with a team from another event'
);
select throws_ok(
  $$insert into public.scores (round_id, entry_id, hole, gross)
    values ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0004-00000000000b', 1, 4)$$,
  'P0001', 'cross_event_reference', 'a score cannot pair a round with an entry from another event'
);
select throws_ok(
  $$select public.save_score('00000000-0000-0000-0006-00000000000b', '00000000-0000-0000-0005-00000000000b', 2, 4, 'cards')$$,
  '42501', null, 'user A cannot save a score in club B''s round'
);

-- Score log.
select lives_ok($$select public.save_score('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1', 1, 4, 'cards')$$, 'save_score inserts');
select lives_ok($$select public.save_score('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1', 1, 5, 'course')$$, 'save_score updates');
select is((select count(*)::int from public.score_log where round_id = '00000000-0000-0000-0000-0000000000a2'), 2,
  'insert then update of a score writes 2 score_log rows');
select results_eq(
  $$select old, new, user_id, screen from public.score_log where round_id = '00000000-0000-0000-0000-0000000000a2' order by id$$,
  $$values (null::int, 4, '00000000-0000-0000-0000-00000000000a'::uuid, 'cards'),
           (4, 5, '00000000-0000-0000-0000-00000000000a'::uuid, 'course')$$,
  'score_log records old -> new, the user and the screen'
);
select is((select count(*)::int from public.scores where round_id = '00000000-0000-0000-0000-0000000000a2'), 1,
  'save_score upserts one row per team and hole');
select lives_ok($$select public.save_score('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1', 1, null, 'cards')$$, 'save_score clears a hole');
select results_eq(
  $$select old, new from public.score_log where round_id = '00000000-0000-0000-0000-0000000000a2' order by id desc limit 1$$,
  $$values (5, null::int)$$,
  'clearing a hole logs old -> null'
);
select lives_ok($$select public.save_score('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1', 1, null, 'cards')$$, 'save_score repeats the same value');
select is((select count(*)::int from public.score_log where round_id = '00000000-0000-0000-0000-0000000000a2'), 3,
  'an update that changes nothing is not logged');
select throws_ok(
  $$update public.scores set hole = 2 where round_id = '00000000-0000-0000-0000-0000000000a2'$$,
  '42501', null, 'a score''s round, team or hole cannot be changed, only gross'
);
select throws_ok(
  $$insert into public.score_log (round_id, hole, old, new) values ('00000000-0000-0000-0000-0000000000a2', 1, 1, 2)$$,
  '42501', null, 'users cannot write score_log directly'
);

-- ===========================================================================
-- As user B (staff, not pro, in club B)
-- ===========================================================================

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';

select is((select count(*)::int from public.score_log where round_id = '00000000-0000-0000-0000-0000000000a2'), 0,
  'user B cannot see club A''s score log');
select is((select count(*)::int from public.score_log), 1, 'user B sees their own club''s score log');
select throws_ok(
  $$insert into public.staff (club_id, email) values ('00000000-0000-0000-0000-0000000000cb', 'c@starter.test')$$,
  '42501', null, 'staff who are not pro cannot invite'
);
select lives_ok(
  $$update public.staff set role = 'pro' where user_id = '00000000-0000-0000-0000-00000000000b'$$,
  'a non-pro''s attempt to promote themselves runs'
);
select is((select role from public.staff where user_id = '00000000-0000-0000-0000-00000000000b'), 'staff',
  'but their role stays staff');

-- ===========================================================================
-- Staff emails (as user A, pro of club A)
-- ===========================================================================

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select throws_ok(
  $$insert into public.staff (club_id, email) select club_id, 'Mixed@Starter.test' from public.staff where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514', null, 'staff emails must be stored lowercase'
);
select lives_ok(
  $$insert into public.staff (club_id, email) select club_id, 'b@starter.test' from public.staff where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  'a pro can invite someone who already has a login'
);
reset role;
select is(
  (select s.user_id from public.staff s join public.clubs c on c.id = s.club_id where c.name = 'Club A' and s.email = 'b@starter.test'),
  '00000000-0000-0000-0000-00000000000b'::uuid,
  'inviting an existing login links the staff row straight away'
);

select * from finish();
rollback;
