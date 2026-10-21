# Piece 1: Shop scramble, design

Approved by Justin on 2026-10-19. This is the first piece of the real Starter app. It follows the build order in `docs/system-design.md` (Phase 1).

## Goal
Justin can run a real scramble outing from start to finish in the app instead of the prototype, from the shop computer: set up the event, build the field and teams, make pairings, enter cards, read the gross and net boards, award prizes, and print everything.

**Done means:** an 8-team, 4-man scramble can be run end to end, the boards and prizes match the scoring engine, and the app is live at a web address the shop computer can open.

## The whole roadmap (for context)
| # | Piece | Status |
|---|---|---|
| **1** | **Shop scramble** (this spec) | Designing |
| 2 | Live: group PIN scoring on phones, realtime board, TV mode, public link | Later |
| 3a | Stroke formats: championship, Stableford, skins, member-guest better ball | Later |
| 3b | Match play: brackets, round robin, member-member 10-point matches, shootout and wildcard | Later |
| 3c | Full print center: pin sheet, notices, flyers, branding | Later |
| 4 | Polish and sell: offline scoring, AI setup, multiple clubs, billing, GHIN | Later |

Each piece gets its own spec. A format piece adds that format's math to `scoring/` first, verified against `golf_math.py`, and its club rules go into `docs/rules/` first.

## Not in piece 1
Phone scoring, live updates, TV mode, public links, formats other than scramble, pin sheet, notices, flyers, logos and club colors, AI setup, offline mode. Other formats appear as templates marked "Coming soon".

---

## 1. Layout
```
tournament-app/
  package.json        npm workspaces: scoring, web
  scoring/            the existing engine, unchanged in behavior
  web/                the new Next.js app (App Router, TypeScript)
    supabase/         database migrations (SQL), checked into git
  docs/
```
- `web` imports the engine as `@starter/scoring`. One `npm install` at the top sets up both.
- Hosting is Vercel, connected to the GitHub repo. Database and logins are Supabase (free plan, project `starter`; Justin signs in with GitHub).
- `.env.local` in `web/` holds `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the publishable key). It's ignored by git. The service-role key is never used by the app and never pasted into chat.

## 2. Data
Tables (Postgres in Supabase). Every table has `club_id` (directly, or through its parent) and `created_at`.

| Table | Columns (main ones) |
|---|---|
| clubs | id, name |
| staff | id, club_id, user_id, email, role (`pro` \| `staff`), invited_at |
| golfers | id, club_id, name, index, nh (no handicap), ghin_number?, deleted_at |
| courses | id, club_id, name, pars[18], si[18], deleted_at |
| tees | id, course_id, name, rating, slope, pars[18]?, si[18]? |
| events | id, club_id, name, date, format (`scramble`), status (`setup` \| `live` \| `final`), course_id, settings (JSON), deleted_at |
| entries | id, event_id, golfer_id, index_used, nh, tee_id?, alternate (bool), deleted_at |
| teams | id, event_id, label, flight?, status (`WD` \| `DQ` \| `NS` \| null), sort, deleted_at |
| team_members | team_id, entry_id, sort |
| rounds | id, event_id, number, mode (`full` \| `front` \| `back` \| `called_off`) |
| groups | id, round_id, start_hole?, start_time?, label, sort |
| group_teams | group_id, team_id, sort |
| scores | id, round_id, team_id?, entry_id?, hole (1-18), gross. Exactly one of team_id or entry_id is set. Unique per (round, team or entry, hole). |
| score_log | id, score key (round, team/entry, hole), old, new, user_id, at, screen. Append-only. |

**Event `settings` JSON** (checked by the app with a schema before saving): holes (`18` \| `front` \| `back`), rounds count, team size (2-4), team mode (`listed` \| `balanced`), team handicap rule (usga / custom / combined / none, same shape as the engine's `TeamHandicapRule`), max team handicap, handicap limits (cap, gap, gap mode), flights count and names, start (`shotgun` \| `teetimes`), start time, interval, prize amounts per place.

**Scores:** only gross strokes are stored. In a scramble, `team_id` is set. Stroke play in piece 3 uses `entry_id`, so the table won't need to change.

**Never really deleted:** removing a golfer, entry, team, course or event sets `deleted_at`, and the screen shows a toast with **Undo** for 10 seconds. A deleted event can also be restored from the Events list ("Recently deleted"). Clearing a score saves `null` and is logged; it is not a delete.

**Score log:** every insert or change to `scores` writes a `score_log` row (database trigger), so no screen can skip it.

**Security:** Row Level Security on every table. A signed-in user can only read and write rows whose club matches a `staff` row for them. Only `pro` can invite or remove staff and permanently remove events (there's no permanent removal in piece 1; that's reserved).

## 3. Logins
- Email and password through Supabase Auth.
- First sign-in: Justin creates his account, and a one-time setup screen creates the club and makes him `pro`. After that, sign-up is closed: new people only get in by invite.
- **Staff screen** (pro only): add a staff member's email, see who's on staff and who has signed up, remove someone (with Undo). The pro tells the new person to go to the sign-up page and create a password with that email. Sign-ups from emails not on the list are refused by the database. No invite email is sent, since that would need the secret service-role key (approved by Justin, 2026-10-19). Supabase's "Confirm email" setting is off.
- Not signed in → every page sends you to the sign-in page.

## 4. Screens
Same navigation as the prototype: the header with event name and **Events** button, the progress bar, and tabs **Event / Pairings / Scoring / Print**, with sub-tabs underneath. Layout works on a laptop and a tablet. Phone layout is piece 2.

| Screen | What it does |
|---|---|
| **Events (home)** | List of events (upcoming first), Recently deleted, templates: "Charity outing" (4-person scramble, shotgun) and "Blank scramble". Other prototype templates are shown as "Coming soon". |
| **Event → Details** | Name, date, course, rounds, 18 / front / back, team size, handicap method and percentages, max team handicap, handicap limits, number of flights and names, start type and time, gift card amount per place. |
| **Event → Course & tees** | Course pars and stroke index, tees with rating and slope (and per-tee par/SI when different). Saved courses reused across events. |
| **Event → Field** | Paste from a spreadsheet or upload a CSV/Excel file. The column matching works like the prototype's (it guesses name, index and tee columns, and you confirm). Club roster: pick golfers already known, and new ones are added to the roster. Players: edit index, tee, no-handicap, remove with Undo. Handicap limit warnings. |
| **Event → Teams** | Listed teams (enter foursomes in order) or **Make balanced teams** (snake draft by index, leftovers become alternates). Move players between teams. Team handicap shown per team. Flights button splits by team handicap. |
| **Pairings** | Build shotgun starts or tee times automatically, then edit by hand (move teams between groups and holes). **Pre-event check** lists problems: missing handicaps, short teams, teams with no start, duplicate starts. |
| **Scoring → Enter cards** | Pick a round and a team, then a hole grid (1-18 or 9) to type gross scores, with running out/in/total. Arrow and Tab keys move between holes. Saves as you go. Set team status WD/DQ/NS. Set a round to full, front, back or called off. |
| **Scoring → Leaderboard** | Gross and net boards per flight, side by side. Positions with ties (T1). WD/DQ/NS at the bottom. "Thru" shows holes entered. Net board hidden when the handicap method is None. |
| **Scoring → Finish** | Prize winners per board and flight with gift card amounts (ties split exactly, cents kept). Mark the event final. Export CSV (field, teams, scores, boards, prizes). |
| **Print** | Pairings, scorecards (one per team with strokes dotted on holes), cart signs, results, starter sheet, alphabetical list. Opens a print-ready page; letter size; plain styling. |
| **Settings** | Club name, Staff (pro only), **Import prototype backup** (scramble events only in piece 1; other formats are listed as "not imported yet"). |

**Labels** are plain language, matching the prototype ("Enter cards", "Make balanced teams", "Pre-event check").

## 5. How the math flows
1. A page loads an event's rows from Supabase.
2. `web/lib/toEngine.ts` turns those rows into the engine's `ScrambleEvent` (course, players, teams, holes, rounds, limits, scores).
3. The engine returns team handicaps, boards, positions and prizes. The page only displays them.

No golf math is written in `web/`. If a screen needs a number the engine doesn't give, it's added to `scoring/` with tests first.

Saving: forms use Next.js server actions. Each save validates its input, writes to Supabase, and refreshes the page. Score entry saves each hole as you leave the box; if a save fails, the box turns red and shows "Not saved — retry".

## 6. Errors and safety
- Validation messages say what to fix in plain words ("Slope must be between 55 and 155").
- Network or database errors show a toast with the problem and a Retry button. Typed scores are never lost from the screen on a failed save.
- Every remove offers Undo. Nothing is permanently deleted in piece 1.
- Importing a backup never overwrites existing events. Imported events are added as new ones.

## 7. Rule changes from this design
Recorded in `docs/rules/scramble.md`:
- Max team handicap is **halved for a 9-hole round**, rounded half up (max 6 → 3). The engine already does this.
- Gift card ties are **split exactly**, cents kept (three teams sharing $250 get $83.33 each, shown to the cent).

Still open, keeping current behavior until Justin decides: minimum drives per player (not tracked), ties at a flight cutoff, and short teams falling back to USGA percentages when only 4-man custom percentages are set.

## 8. Testing
- **Engine:** existing `scoring` tests (hand-worked cases plus 400-event parity against `golf_math.py`) keep passing.
- **Row-to-engine conversion:** tests for `toEngine.ts` using sample rows, checking the engine gets the same input the prototype backup would give for the same event.
- **Backup import:** a prototype backup with a scramble event imports, and the imported rows give the engine the same input that `scoring/src/prototype.ts` reads from that file.
- **End to end:** one Playwright test in a real browser against a test Supabase database: sign in, create an event, import 32 players, make balanced teams, build a shotgun, enter cards for 8 teams, then check the gross and net boards, prizes, and that each print page opens.
- **Printouts:** checked by eye against the prototype's prints.

## 9. What Justin does
1. Supabase account and project: done (2026-10-19).
2. When the database step starts: paste the Project URL and publishable key when asked (they go into `.env.local`).
3. At the end: sign in to Vercel with GitHub and import the repo (about 5 minutes, guided).
