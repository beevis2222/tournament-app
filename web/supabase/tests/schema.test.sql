-- pgTAP checks for the schema migration. Run with: npx supabase test db --linked
-- Everything runs in one transaction and is rolled back, so the database is left untouched.
-- Assumes the database has no clubs yet (the test project), because sign-up is open only then.
begin;
create extension if not exists pgtap with schema extensions;

select plan(21);

-- Fixed ids for readability.
-- user A  = 00000000-0000-0000-0000-00000000000a (pro of club A, created through create_club)
-- user B  = 00000000-0000-0000-0000-00000000000b (staff of club B, invited)
-- club B  = 00000000-0000-0000-0000-0000000000cb

-- First sign-up is allowed while no clubs exist.
select lives_ok(
  $$insert into auth.users (id, email, aud, role)
    values ('00000000-0000-0000-0000-00000000000a', 'a@starter.test', 'authenticated', 'authenticated')$$,
  'first user can sign up while there are no clubs'
);

-- Act as user A.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
set local role authenticated;

-- create_club makes the club and makes A its pro.
select ok(public.create_club('Club A') is not null, 'create_club returns the new club id');
select ok(
  (select role = 'pro' and email = 'a@starter.test' from public.staff where user_id = '00000000-0000-0000-0000-00000000000a'),
  'create_club makes the caller pro, with their email'
);

-- A second club cannot be created.
select throws_ok($$select public.create_club('Club B')$$, 'P0001', 'club_exists', 'create_club raises club_exists the second time');

reset role;

-- Club B with an invited staff member (set up directly, as the database owner).
insert into public.clubs (id, name) values ('00000000-0000-0000-0000-0000000000cb', 'Club B');
insert into public.staff (club_id, email, role) values ('00000000-0000-0000-0000-0000000000cb', 'b@starter.test', 'staff');

-- Strangers are refused once a club exists.
select throws_ok(
  $$insert into auth.users (id, email, aud, role)
    values ('00000000-0000-0000-0000-0000000000ff', 'stranger@starter.test', 'authenticated', 'authenticated')$$,
  'P0001', 'not_invited', 'guard_signup refuses an email that is not on staff'
);

-- Invited emails can sign up (any case), and get linked to their staff row.
select lives_ok(
  $$insert into auth.users (id, email, aud, role)
    values ('00000000-0000-0000-0000-00000000000b', 'B@Starter.test', 'authenticated', 'authenticated')$$,
  'an invited email can sign up'
);
select is(
  (select user_id from public.staff where email = 'b@starter.test'),
  '00000000-0000-0000-0000-00000000000b'::uuid,
  'sign-up links the staff row to the new user'
);

-- Events in both clubs, plus a team and round in club A.
insert into public.events (id, club_id, name, date)
select '00000000-0000-0000-0000-0000000000ea', c.id, 'A event', date '2026-10-19'
from public.clubs c where c.name = 'Club A';
insert into public.events (id, club_id, name, date)
values ('00000000-0000-0000-0000-0000000000eb', '00000000-0000-0000-0000-0000000000cb', 'B event', date '2026-10-19');
insert into public.teams (id, event_id, label) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000ea', 'Team 1');
insert into public.rounds (id, event_id, number) values ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000ea', 1);

-- Act as user A again.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
set local role authenticated;

-- A sees their own event and not club B's.
select is((select count(*)::int from public.events where id = '00000000-0000-0000-0000-0000000000ea'), 1, 'user A sees their own club''s event');
select is((select count(*)::int from public.events where id = '00000000-0000-0000-0000-0000000000eb'), 0, 'user A cannot see club B''s event');

-- A cannot write into club B.
select throws_ok(
  $$insert into public.events (club_id, name, date) values ('00000000-0000-0000-0000-0000000000cb', 'sneaky', date '2026-10-19')$$,
  '42501', null, 'user A cannot add an event to club B'
);

-- Nothing is deleted: delete is refused.
select throws_ok($$delete from public.events$$, '42501', null, 'delete from events is refused for staff');

-- Score writes are logged with old/new, user and screen.
select lives_ok($$select public.save_score('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1', 1, 4, 'cards')$$, 'save_score runs');
select lives_ok($$select public.save_score('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1', 1, 5, 'course')$$, 'save_score runs');
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

-- Clearing a hole saves null and is logged.
select lives_ok($$select public.save_score('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1', 1, null, 'cards')$$, 'save_score runs');
select results_eq(
  $$select old, new from public.score_log where round_id = '00000000-0000-0000-0000-0000000000a2' order by id desc limit 1$$,
  $$values (5, null::int)$$,
  'clearing a hole logs old -> null'
);

-- Users cannot write the log themselves.
select throws_ok(
  $$insert into public.score_log (round_id, hole, old, new) values ('00000000-0000-0000-0000-0000000000a2', 1, 1, 2)$$,
  '42501', null, 'users cannot write score_log directly'
);

-- Act as user B (staff, not pro, in club B).
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';

-- B cannot see club A's score log.
select is((select count(*)::int from public.score_log), 0, 'user B cannot see club A''s score log');

-- Only a pro can invite staff.
select throws_ok(
  $$insert into public.staff (club_id, email) values ('00000000-0000-0000-0000-0000000000cb', 'c@starter.test')$$,
  '42501', null, 'staff who are not pro cannot invite'
);

reset role;

select * from finish();
rollback;
