# Starter — System Design (v1)

Starter is a golf tournament manager for private clubs, built to replace Golf Genius. The single-file prototype (`fairway-tournament-prototype.html`) proves the rules and screens. This document describes how to turn it into a real app that many phones, the shop computer and the clubhouse TV can all use at once.

Builder: one golf professional, with Claude Code writing most of the code. Every choice below favors **fewer moving parts** and **free tiers to start** over cleverness.

---

## 1. Requirements

### What it must do (functional)
- Run events: club championship, match play, member-guest, member-member, scramble outings, skins, Stableford (templates from the prototype).
- Build the field: paste or upload a spreadsheet, handicaps, tees, flights.
- Make pairings: automatic, round robin for member-member, brackets for match play, plus hand edits.
- Collect scores two ways: the shop enters cards, and players score on the course from their phones.
- Show live leaderboards on phones, a public link, and the clubhouse TV.
- Finish the event: flight winners, shootout plus wildcard, prizes, contests, CSV export.
- Print everything: pairings, scorecards, cart signs, pin sheet, the 24x36 member-member board, and brackets.

### How it must behave (non-functional)
| Need | Target |
|---|---|
| Scoring math | Matches the prototype **exactly** (`golf_math.py` is the reference) |
| Live updates | A score shows up on the leaderboard and TV within ~2 seconds |
| Phones | Works on any phone, no app store, no sideways scrolling |
| Bad signal on the course | Scores entered offline are saved and sent later (phase 2) |
| Safety | Nothing is deleted without Undo, and every score change is logged |
| Cost | $0 while building, then low monthly hosting once clubs pay |

### Constraints
- A solo builder who is new to code, so the stack must be popular and well documented, and Claude has to know it well.
- Scale is small. One club means at most ~200 players and ~4,000 hole scores per round, with ~50 phones live at once. Any modern database handles this easily.

---

## 2. Recommended stack

| Piece | Choice | Why |
|---|---|---|
| App (screens and logic) | **Next.js (React + TypeScript)** | One codebase serves the shop, phones, TV and print pages. It's the most common web stack, so Claude Code is strong at it. |
| Database, logins, live updates | **Supabase** (Postgres) | A real relational database fits golf data (events → teams → players → scores). It has logins built in, and its "realtime" feature pushes new scores to every screen. |
| Hosting | **Vercel** | Connects to your GitHub repo. Every push goes live automatically, and every change gets its own preview link. |
| Scoring engine | **Plain TypeScript module** with no screens or database inside | Golf rules live in one place and are tested against the prototype's math. |
| Tests | **Vitest** | Runs hundreds of scoring checks in seconds before anything goes live. |
| AI features | **Claude API**, called from the server | Handles the plain-English setup ("member-member, 2 flights") and flyer text. A rule-based fallback works if AI is down. |

### Alternatives considered
- **Firebase.** Its realtime is great, but its document-style database makes standings and flight queries awkward. Postgres is a better fit.
- **Python (Django or FastAPI).** It matches `golf_math.py`, but it needs a separate front end and makes live updates harder. Two systems is too much for one builder.
- **Keep the single HTML file.** It's the fastest option today, but it can't share data between phones, which is the whole point of live scoring.
- **Native iPhone/Android app.** That means app store reviews and two codebases. A mobile web app ("add to home screen") gets you 95% of the benefit.

---

## 3. High-level design

```
  Shop computer      Player phones        Clubhouse TV      Public link / QR
  (setup, cards,     (score on the        (full-screen      (read-only
   print center)      course, PIN)         leaderboard)      leaderboard)
        │                  │                    │                  │
        └──────────────────┴─────────┬──────────┴──────────────────┘
                                     │  Next.js app (Vercel)
                                     │  ├─ pages and screens
                                     │  ├─ server actions (save, validate)
                                     │  └─ scoring engine (pure TypeScript)
                                     │
                         ┌───────────┴────────────┐
                         │  Supabase              │
                         │  ├─ Postgres database  │──── realtime: new scores pushed
                         │  ├─ logins (pro/staff) │     to every open screen
                         │  └─ file storage       │     (logos, photos)
                         └────────────────────────┘
                                     │
                               Claude API (setup text, flyers)
```

**How a score travels:** a player taps +/- on hole 7 → the phone saves gross strokes to the `scores` table → the change log records it → Supabase realtime tells every open leaderboard → each screen reruns the scoring engine and redraws.

**Key rule:** only **gross strokes per player per hole** are stored. Net scores, points, standings, skins and the shootout are always **calculated** by the scoring engine, so they can never drift out of sync.

---

## 4. Data model

```
clubs            id, name, brand (logo, fonts, colors)
staff            id, club_id, user_id, role (pro | staff)
golfers          id, club_id, name, index, ghin_number?            ← reused across events
courses / tees   id, club_id, name, rating, slope, pars[18], stroke_index[18]

events           id, club_id, name, date, format, status, settings (JSON)
                 settings JSON holds the prototype's event options: net/gross, rounds,
                 holes mode, allowance, flights, match settings, shootout,
                 prizes, contests, notice, pins
entries          id, event_id, golfer_id, index_used, tee_id, flight, status (WD/DQ/NS)
teams            id, event_id, label, flight
team_members     team_id, entry_id
rounds           id, event_id, number, mode (full | front | back | called_off), day
groups           id, round_id, start (time or hole), label, scoring_pin
group_teams      group_id, team_id                     ← a group can be a match
scores           round_id, entry_id, hole, gross       ← the only score source of truth
score_log        id, score key, old, new, who, when, from_screen   ← append-only
match_overrides  group_id, result                      ← the pro's "Set hole points"
picks            event_id, kind (flight_winner | wildcard), flight?, team_id
shootout_holes   event_id, hole, scores JSON, out_team_ids, chip_off
contests         event_id, type (ctp | ld), hole, round, winner, measure, prize
```

Why it's shaped this way:
- **Golfers live at the club level**, separate from **entries** in each event. That makes season points, club history and a "same field as last year" button easy later.
- **Event settings stay as JSON**, matching the prototype, so new options don't require database changes. Anything you search or sort by (date, format, status) gets its own column.
- The prototype's **backup file can be imported directly**, so events you build in the prototype aren't lost.

---

## 5. Screens

Keep the prototype's navigation, since it already works for staff:

| Area | Screens |
|---|---|
| Home | Event list, templates, new event (with the plain-English description box) |
| Event | Details (settings, course and tees) · Field (import, players, flights) |
| Pairings | Auto pairings, round robin / brackets, edit mode, pre-event check |
| Scoring | Leaderboard · Enter cards (shop) · Match cards and "Set hole points" |
| Finish | Flight winners, shootout plus wildcard, prizes, contests, export |
| Print & TV | Print center (every piece in the product spec) · Clubhouse TV mode |
| **New in the real app** | Staff login · Group scoring link + PIN (no login for players) · Public leaderboard link |

Players never make an account. They scan the cart-sign QR code and enter their group's 4-digit PIN.

---

## 6. Build order

| Phase | Deliverable | Why this order |
|---|---|---|
| **0. Foundation** ✅ started | `CLAUDE.md`, **scoring engine + tests** (`scoring/`), verified against `golf_math.py` | The math is the product. Prove it first, without any screens. |
| **1. Shop-only 4-man scramble** | Events, field import, team draw or listed teams, enter cards, gross + net leaderboards, prizes, pairings and cart sign prints | Justin's pick. It's the simplest scoring (one score per team per hole) and fits outings, so it's a great first slice. |
| **2. Live** | Group PIN scoring on phones, realtime leaderboard, TV mode, public link | This is the jump past the prototype. |
| **3. All formats** | Member-member (10-point matches + shootout), stroke play, match play brackets, skins, Stableford, the full print center | Builds on the same engine. |
| **4. Polish and sell** | Offline scoring, AI setup, multiple clubs, billing, then GHIN through the USGA GPA program | Needed once a second club wants it. |

---

## 7. Trade-offs to be aware of

- **Supabase + Vercel ties you to two vendors.** Both run on standard pieces (Postgres, Next.js), so moving later is work but not a rewrite. Free tiers cover development. Once real clubs are paying, plan for paid plans (Vercel's free plan is for non-commercial use).
- **Event settings as JSON** gives you speed now. The cost is that the database can't check those values, so the app has to validate them.
- **Recomputing standings on every screen** is simple and always correct at this scale. If you ever host 50 events at once, cache the results.
- **No player accounts** means less friction on the first tee. The cost is that anyone with the PIN can enter scores, which the change log and staff review make up for.

## 8. What to revisit as it grows
1. Multiple clubs on one system (every table already carries `club_id`).
2. Offline scoring on phones with weak course signal.
3. GHIN score posting (official USGA access only).
4. Tee sheet and billing integrations, online registration and entry fees.
5. Texting and email (pairings out, results out).

---

## Open questions for Justin
1. ~~Where is the prototype?~~ Saved at `prototype/fairway-tournament-prototype.html` (copied from the Claude artifact, version of 2026-09-30). It's a reference only. Don't edit it, and don't ship it.
2. ~~First event?~~ 4-man scramble, gross and net. Rules are in `docs/rules/scramble.md`.
3. Will staff besides you need their own logins in phase 1, or is it just you to start?
