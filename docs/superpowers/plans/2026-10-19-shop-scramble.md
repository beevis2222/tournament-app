# Shop Scramble (Piece 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Next.js + Supabase web app in `web/` that runs a scramble outing end to end from the shop computer, using the existing `scoring/` engine for all golf math.

**Architecture:** npm workspaces (`scoring`, `web`). Pages are Next.js App Router server components that load rows from Supabase (RLS-scoped to the signed-in staff member's club), convert them with a pure `toEngine()` into the engine's `ScrambleEvent`, and render what the engine returns. Writes go through server actions. Pure logic (import parsing, pairings, backup import, CSV) lives in `web/src/lib/` modules with Vitest tests and no Supabase imports.

**Tech Stack:** Node 22.18+, Next.js 15 (App Router, TypeScript, `src/` dir), React 19, `@supabase/supabase-js` + `@supabase/ssr`, Zod, SheetJS (`xlsx`), Vitest, Playwright, Supabase CLI (migrations), Vercel.

**Spec:** `docs/superpowers/specs/2026-10-19-shop-scramble-design.md`. Club rules: `docs/rules/scramble.md`. Screen and behavior reference: `prototype/fairway-tournament-prototype.html` (read only; never edit or ship).

## Global Constraints

- No golf math in `web/`. Handicaps, totals, positions, flights, team draws and prizes come from `@starter/scoring`. If a number is missing, add it to `scoring/` with tests first.
- Only gross strokes are stored. Round half up (`jsRound`), never banker's rounding.
- Nothing is permanently deleted. Removes set `deleted_at` and show a toast with **Undo** for 10 seconds.
- Every write to `scores` is logged to `score_log` by a database trigger.
- The app only uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (in `web/.env.local`, git-ignored). The service-role key is never used and never pasted in chat.
- Plain-language labels matching the prototype: "Enter cards", "Make balanced teams", "Pre-event check", "Import prototype backup".
- Laptop and tablet layout (≥ 768px wide). Phone layout is piece 2.
- Gift card ties split exactly; show cents (`$83.33`). Max team handicap halves for 9 holes (engine already does this).
- Never edit `prototype/`. `scoring/` behavior must not change; `npm test` in `scoring/` must keep passing.
- The repo `.gitignore` contains the Python rule `lib/`. Task 1 adds `!web/src/lib/` so app code is committed.

## Spec adjustment (approved by Justin 2026-10-19; spec §3 updated)

Spec §3 says the pro "sends an invite". Sending invite emails requires the service-role key, which the spec forbids. This plan instead: the pro **adds a staff email** on the Staff screen; that person goes to the app's sign-up page and creates a password with that email. A database trigger rejects sign-ups from any email that isn't on the staff list (except the very first user, who creates the club). Supabase's "Confirm email" setting is turned off (its built-in mailer only sends to project team members).

## Review Focus

1. **Spreadsheet quirks** — "Last, First" names, plus indexes ("+2.1"), blank index (→ no handicap), unknown tee names, blank rows, a header row vs none. Expect: imported the way the prototype does, with skipped rows listed. Tested in Task 4.
2. **Two people editing the same card** — a hole saved from two screens. Expect: last write wins, both writes appear in `score_log`, no error. Tested in Task 2 (trigger logs every update) and Task 11 (upsert on the unique key).
3. **Called-off or shortened round after cards are entered** — expect boards to recompute from only the holes in play, entered scores kept (not deleted). Tested in Task 11.
4. **More than 18 groups on a shotgun** — expect "1A…18A, 1B…" starts, as the prototype does. Tested in Task 7.
5. **A sign-up from an email that isn't on the staff list** — expect a plain "Ask the pro to add your email first" message, no account created. Tested in Task 2 (SQL test) and Task 3.

---

## File structure

```
package.json                       workspaces root (scripts: test, dev, e2e)
.gitignore                         + !web/src/lib/
web/
  package.json, next.config.ts, tsconfig.json, vitest.config.ts, playwright.config.ts
  .env.example                     the two NEXT_PUBLIC_ names, no values
  supabase/migrations/20261019000000_schema.sql   tables, RLS, triggers, RPCs
  supabase/tests/schema.test.sql                  pgTAP checks (`supabase test db`)
  src/lib/types.ts                 Db row types + EventBundle + EventSettings (Zod)
  src/lib/toEngine.ts              EventBundle -> ScrambleEvent
  src/lib/import/parse.ts          spreadsheet text/rows -> ImportResult (port of prototype)
  src/lib/pairings.ts              groups + starts (port of prototype)
  src/lib/backup.ts                prototype backup JSON -> EventBundle[]
  src/lib/csv.ts                   EventBundle + engine output -> CSV text
  src/lib/money.ts                 formatMoney
  src/lib/supabase/server.ts, client.ts, middleware.ts
  src/lib/db/*.ts                  loadEvent, save* helpers (thin, Supabase only)
  src/app/(auth)/sign-in, sign-up, setup
  src/app/events/…                 home, new, [id]/details|course|field|teams|pairings|cards|board|finish|print/*
  src/app/settings/…               club, staff, import
  src/components/…                 Shell (header, progress, tabs), Toast+Undo, HoleGrid, Board
  test/unit/*.test.ts              Vitest
  e2e/outing.spec.ts               Playwright
```

---

### Task 1: Workspace and Next.js app skeleton

**Files:**
- Create: `package.json` (root), `web/package.json`, `web/next.config.ts`, `web/tsconfig.json`, `web/vitest.config.ts`, `web/src/app/layout.tsx`, `web/src/app/page.tsx`, `web/src/app/globals.css`, `web/.env.example`, `web/test/unit/engine-import.test.ts`
- Modify: `.gitignore` (append `!web/src/lib/`), `CLAUDE.md` (add `web/` to "Where things are", run commands)

**Interfaces:**
- Produces: `npm test` at root runs `scoring` tests then `web` Vitest; `npm run dev` starts Next on port 3000; `@starter/scoring` importable from `web`.

- [ ] **Step 1:** Root `package.json`: `{"private":true,"workspaces":["scoring","web"],"scripts":{"test":"npm test -w scoring && npm test -w web","dev":"npm run dev -w web","e2e":"npm run e2e -w web"}}`. Create the app with `npx create-next-app@15 web --ts --app --src-dir --eslint --no-tailwind --import-alias "@/*" --use-npm`, then add `"@starter/scoring": "*"` to `web/package.json` dependencies, `vitest` to devDependencies, and scripts `"test":"vitest run"`.
- [ ] **Step 2:** `next.config.ts`: `transpilePackages: ["@starter/scoring"]`. `tsconfig.json`: add `"allowImportingTsExtensions": true` (the engine imports `./types.ts`).
- [ ] **Step 3: Write the failing test** `web/test/unit/engine-import.test.ts`:
  ```ts
  import { jsRound, payoutAmounts } from "@starter/scoring";
  test("engine is importable from web", () => {
    expect(jsRound(7.5)).toBe(8);
    expect(payoutAmounts([{id:"a",position:1,eligible:true},{id:"b",position:1,eligible:true},{id:"c",position:1,eligible:true}],[150,100]).get("a")).toBeCloseTo(83.333, 3);
  });
  ```
- [ ] **Step 4:** Run `npm install` at root, then `npm test`. Expected: scoring tests pass, the web test passes.
- [ ] **Step 5:** Replace the starter `page.tsx` with a placeholder "Starter" heading. Port the prototype's CSS variables (`:root` block near the top of the prototype `<style>`) into `globals.css` so later screens match its look. Run `npm run dev -w web`, open http://localhost:3000, see "Starter". Run `npm run build -w web`: succeeds.
- [ ] **Step 6:** `git status` shows `web/src/lib` would be tracked (create an empty `web/src/lib/.gitkeep` to check). Commit: `Add web app workspace (Next.js) using the scoring engine`.

### Task 2: Database schema, security and triggers

**Files:**
- Create: `web/supabase/config.toml` (via `npx supabase init` inside `web/`), `web/supabase/migrations/20261019000000_schema.sql`, `web/supabase/tests/schema.test.sql`

**Interfaces:**
- Produces (SQL): tables exactly as spec §2, plus:
  - `staff.email text not null`, `staff.user_id uuid null references auth.users`, unique `(club_id, email)`, `removed_at timestamptz null`.
  - `function public.my_club_ids() returns setof uuid` — `security definer`, `stable`; club ids from `staff` where `user_id = auth.uid()` and `removed_at is null`.
  - `function public.is_pro(club uuid) returns boolean` — security definer.
  - `function public.create_club(name text) returns uuid` — security definer; raises `'club_exists'` if any club exists; inserts club + `staff(role 'pro', user_id auth.uid(), email from auth.users)`.
  - Trigger `before insert on auth.users` → `public.guard_signup()`: allow if no clubs exist; else allow only if `lower(new.email)` matches a non-removed `staff.email`; otherwise `raise exception 'not_invited'`.
  - Trigger `after insert on auth.users` → links `staff.user_id` by email.
  - Trigger `after insert or update on scores` → inserts `score_log(round_id, team_id, entry_id, hole, old, new, user_id auth.uid(), at now(), screen current_setting('app.screen', true))`.
  - RLS on every public table: select/insert/update allowed when the row's club (directly or via event → club) is in `my_club_ids()`. `staff` insert/update only when `is_pro(club_id)`. No `delete` policies anywhere (soft delete only).
  - `scores`: `check ((team_id is null) <> (entry_id is null))`, `check (hole between 1 and 18)`, `check (gross is null or gross between 1 and 20)`, unique indexes on `(round_id, team_id, hole)` and `(round_id, entry_id, hole)`.
  - `events.settings jsonb not null default '{}'`.
  - `function public.save_score(p_round uuid, p_team uuid, p_hole int, p_gross int, p_screen text) returns void` — security invoker (RLS applies); `set_config('app.screen', p_screen, true)` then upsert on `(round_id, team_id, hole)`, so the log trigger sees the screen in the same transaction.

- [ ] **Step 1: Write the SQL test** `schema.test.sql` (pgTAP, run by `supabase test db`): as two different fake users in two clubs, user A cannot select club B's events; `delete from events` is refused for staff; an update to `scores` writes 2 rows to `score_log` after insert + update; `guard_signup` raises `not_invited` for an unknown email once a club exists; `create_club` raises `club_exists` the second time.
- [ ] **Step 2: Justin, one time (guided in chat):** run `npx supabase login` and `npx supabase link --project-ref <ref>` in a Terminal tab, typing his database password there himself. In the Supabase dashboard: Authentication → Sign In / Providers → Email → turn **off** "Confirm email". Create a second free project `starter-test` for automated tests and link-able by ref.
- [ ] **Step 3:** Write the migration. Apply to `starter-test` with `npx supabase db push --project-ref <test-ref>`; run `npx supabase test db --linked` against it. Expected: all pgTAP checks pass.
- [ ] **Step 4:** Generate types: `npx supabase gen types typescript --project-id <ref> > web/src/lib/database.types.ts`.
- [ ] **Step 5:** Apply the migration to `starter` (production) with `db push`. Commit: `Database schema with club security, soft delete and score log`.

### Task 3: Sign-in, first-time setup, staff screen

**Files:**
- Create: `web/src/lib/supabase/server.ts`, `client.ts`, `web/src/middleware.ts`, `web/src/app/sign-in/page.tsx`, `web/src/app/sign-up/page.tsx`, `web/src/app/setup/page.tsx`, `web/src/app/settings/staff/page.tsx`, `web/src/app/settings/staff/actions.ts`, `web/src/lib/authErrors.ts`, `web/test/unit/authErrors.test.ts`

**Interfaces:**
- Produces: `createServerSupabase(): SupabaseClient<Database>` (cookies via `@supabase/ssr`); `getStaff(): Promise<{ userId, clubId, role: "pro" | "staff" } | null>`; `friendlyAuthError(message: string): string`.
- Routing: no session → `/sign-in`. Session but no staff row and no club exists → `/setup`. Otherwise → `/events`.

- [ ] **Step 1: Failing test** `authErrors.test.ts`: `friendlyAuthError("Database error saving new user")` → `"Ask the pro to add your email on the Staff screen first."`; `"Invalid login credentials"` → `"That email and password don't match."`; anything else → `"Something went wrong signing in. Try again."`.
- [ ] **Step 2:** Implement `friendlyAuthError` in `web/src/lib/authErrors.ts`; run `npm test -w web`: PASS.
- [ ] **Step 3:** Supabase clients and middleware per the `@supabase/ssr` Next.js guide (refresh session in middleware, redirect rules above). Sign-in and sign-up forms (email, password ≥ 8 chars). Setup page: "Club name" → `rpc('create_club')` → `/events`.
- [ ] **Step 4:** Staff page (pro only; staff see "Only the pro can manage staff"): list staff (email, role, "Signed up" yes/no), "Add staff email" form, Remove (sets `removed_at`, toast with Undo). After adding, show: "Tell them to go to `<site>/sign-up` and create a password with this email."
- [ ] **Step 5:** Manual check against `starter-test`: create the first user → setup → club; add a staff email; sign up with it (works) and with another email (shows the not-invited message). Commit: `Sign in, club setup and staff list`.

### Task 4: Spreadsheet import parser (pure)

**Files:**
- Create: `web/src/lib/import/parse.ts`, `web/test/unit/import.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type ColumnRole = "ignore" | "name" | "first" | "last" | "index" | "tee" | "group" | "ghin";
  export function parseDelimited(text: string): string[][];
  export function parseIdx(v: unknown): number | null;          // "+2.1" -> -2.1, "54.1" -> null
  export function fixName(n: string): string;                     // "Smith, Bob" -> "Bob Smith"
  export function guessMap(rows: string[][], teeNames: string[]): { header: boolean; map: ColumnRole[] };
  export interface ImportedPlayer { name: string; index: number; nh: boolean; teeName: string | null; teeUnknown: boolean; ghin: string | null; group: string | null; row: number }
  export function parseImport(rows: string[][], header: boolean, map: ColumnRole[], teeNames: string[]): { players: ImportedPlayer[]; skipped: { row: number; reason: string }[]; multi: boolean };
  export function sheetGroups(players: ImportedPlayer[]): { label: string; players: ImportedPlayer[] }[];
  ```
  Port of prototype `parseDelimited`, `splitLine`, `parseIdx`, `guessMap`, `fixName`, `makePlayer`, `parseImport`, `sheetGroups` (prototype lines ~1569–1670), with the prototype's `E().tees` lookup replaced by the `teeNames` parameter (case-insensitive, trailing "tee(s)" ignored). Behavior must match the prototype line for line.

- [ ] **Step 1: Failing tests** in `import.test.ts`:
  - tab-separated with header `Name\tIndex\tTee` → map `["name","index","tee"]`, header `true`.
  - `parseIdx("+2.1") === -2.1`, `parseIdx("(12.4)") === 12.4`, `parseIdx("55") === null`, `parseIdx("") === null`.
  - `"Smith, Bob"` row imports as `"Bob Smith"`.
  - blank index → `nh: true, index: 0`; tee `"Blue Tees"` with teeNames `["Blue","White"]` → `teeName: "Blue"`; tee `"Gold"` → `teeUnknown: true`.
  - no header, columns `Bob Smith, 12.4` → guessed `["name","index"]`.
  - multi-name foursome sheet with header `Team, Player 1, Hcp 1, Player 2, Hcp 2` → `multi: true`, 2 players per row, `group` = team cell.
  - a row with no name → listed in `skipped` with reason `"no name"`.
- [ ] **Step 2:** Run `npm test -w web -- import`: FAIL (module missing).
- [ ] **Step 3:** Implement `parse.ts` as specified.
- [ ] **Step 4:** Run: PASS. Commit: `Spreadsheet import parser ported from the prototype`.

### Task 5: Row types, settings schema and `toEngine`

**Files:**
- Create: `web/src/lib/types.ts`, `web/src/lib/toEngine.ts`, `web/test/unit/toEngine.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const EventSettings = z.object({
    holes: z.enum(["18","front","back"]).default("18"),
    rounds: z.number().int().min(1).max(4).default(1),
    teamSize: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(4),
    teamMode: z.enum(["listed","balanced"]).default("balanced"),
    teamHandicap: /* zod mirror of TeamHandicapRule */ .default({ method: "usga" }),
    maxTeamHandicap: z.number().int().min(0).nullable().default(null),
    limits: z.object({ cap: z.number().nullable().optional(), gap: z.number().nullable().optional(), gapMode: z.enum(["flag","reduce"]).optional() }).default({}),
    flights: z.number().int().min(1).max(6).default(1),
    flightNames: z.array(z.string()).default([]),
    start: z.enum(["shotgun","teetimes"]).default("shotgun"),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).default("08:00"),
    interval: z.number().int().min(5).max(20).default(10),
    prizes: z.array(z.number().min(0)).default([150, 100, 50]),
  });
  export type EventSettings = z.infer<typeof EventSettings>;
  export interface EventBundle {
    event: { id; name; date; status; settings: EventSettings };
    course: { id; name; pars: number[]; si: number[] };
    tees: { id; name; rating: number; slope: number; pars: number[] | null; si: number[] | null }[];
    entries: { id; golferId; name; indexUsed: number; nh: boolean; teeId: string | null; alternate: boolean }[];
    teams: { id; label; flight: number | null; status: "WD"|"DQ"|"NS"|null; sort: number; entryIds: string[] }[];
    rounds: { id; number: number; mode: RoundMode }[];
    groups: { id; roundId; startHole: string | null; startTime: string | null; label; sort: number; teamIds: string[] }[];
    scores: { roundId; teamId: string; hole: number; gross: number | null }[];
  }
  export function toEngine(b: EventBundle): ScrambleEvent;
  ```
  `toEngine`: players from non-alternate entries (`index: indexUsed`, `nh`, `teeId`); teams in `sort` order (`flight` 0-based, `status` when set); `rounds` sorted by `number` mapped to modes; `scores[r][teamId]` = 18-slot array (index = hole − 1), `null` where missing; tee `pars`/`si` only when non-null; `maxTeamHandicap`, `teamHandicap`, `limits`, `holes` from settings.

- [ ] **Step 1: Failing tests:** a hand-built 2-team bundle → `toEngine` output deep-equals a hand-written `ScrambleEvent`; scores out of order still land at the right hole; a team with no scores gets no card; `EventSettings.parse({})` gives the defaults above; `EventSettings.parse({ interval: 3 })` throws.
- [ ] **Step 2:** Run: FAIL. **Step 3:** Implement. **Step 4:** Run: PASS. Commit: `Event row types, settings schema and conversion to the engine`.

### Task 6: Prototype backup import (pure) with parity

**Files:**
- Create: `web/src/lib/backup.ts`, `web/test/unit/backup.test.ts`

**Interfaces:**
- Consumes: `EventBundle`, `EventSettings` (Task 5); `fromPrototypeScramble` (engine).
- Produces:
  ```ts
  export interface BackupResult { bundles: EventBundle[]; skipped: { name: string; reason: string }[] }
  export function readBackup(text: string): BackupResult;   // throws Error("That file isn't a backup from this app.") on bad JSON / wrong kind
  ```
  Only `event.format === "scramble"` imports; others go to `skipped` with reason `"<format> isn't supported yet"`. IDs are new UUIDs (`crypto.randomUUID()`), consistently mapped. Settings mapping: `scoring:"gross"` → `teamHandicap {method:"none"}`, else usga; `holesMode` → `holes`; `rmode` → round modes (`"cancel"` → `called_off`); `limits`; `teamSize`; `flights`; prototype `pairings.teams[].flight`, `pairings.status`; `cards[r][teamId].team` → scores.

- [ ] **Step 1: Failing tests:**
  - Parity: wrap every case in `scoring/test/fixtures/scramble-parity.json` as `{kind:"starter-backup",version:1,events:[case.event]}`; for each, `toEngine(readBackup(text).bundles[0])` gives, per team (matched by label), the same `scrambleTeamHandicap` and per-round `scrambleRound` gross/net/thru/handicap as `fromPrototypeScramble(case.event)`. All 400 pass.
  - `readBackup("{}")` throws the message above; a backup with one `matchplay` event returns 0 bundles and 1 skipped.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. Commit: `Import prototype backups (scramble), checked on 400 events`.

### Task 7: Pairings (pure)

**Files:**
- Create: `web/src/lib/pairings.ts`, `web/test/unit/pairings.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface DraftGroup { teamIds: string[]; start: string } // "1", "1A", "8:10 am"
  export function buildGroups(teamIds: string[], s: Pick<EventSettings,"start"|"startTime"|"interval">, rand?: () => number): DraftGroup[];
  export function startLabel(i: number, total: number, s: Pick<EventSettings,"start"|"startTime"|"interval">): string;
  export function fmtTime(hhmm: string): string;   // "13:05" -> "1:05 pm", "00:10" -> "12:10 am"
  export interface Problem { level: "error" | "warning"; text: string }
  export function preEventCheck(b: EventBundle): Problem[];
  ```
  Scramble = one team per group (prototype `buildGroups` `perGroup`). Shotgun: hole `(i % 18) + 1`, with `A`/`B` suffix (`i < 18 ? "A" : "B"`) only when total > 18. Tee times: `startTime + i * interval` minutes. Order shuffled with `rand` (default `Math.random`) using Fisher–Yates.
  `preEventCheck` messages (exact text): `"<name> has no handicap index."` (warning, nh), `"<team> has only N players."` (warning, short team), `"<team> has no starting hole or time."` (error), `"Two groups start at <start> in round N."` (error, duplicate), `"No course pars set."` (error).

- [ ] **Step 1: Failing tests:** 18 teams shotgun → starts `"1"`…`"18"`; 20 teams → `"1A"`…`"18A"`, `"1B"`, `"2B"`; tee times from `"08:00"` every 10 → `"8:00 am"`, `"8:10 am"`, `"8:20 am"`; `fmtTime("12:00")==="12:00 pm"`; a seeded `rand` gives a stable order; `preEventCheck` on a bundle with a 3-player team, an NH player, a team with no group and two groups at `"1"` returns those four messages exactly.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. Commit: `Shotgun and tee time pairings, pre-event check`.

### Task 8: App shell, events list, new event, details, course & tees

**Files:**
- Create: `web/src/components/Shell.tsx` (header, Events button, progress bar, tabs Event / Pairings / Scoring / Print, sub-tabs), `web/src/components/Toast.tsx` (toast + Undo, 10 s), `web/src/lib/db/events.ts`, `web/src/app/events/page.tsx`, `web/src/app/events/new/actions.ts`, `web/src/app/events/[id]/details/page.tsx` + `actions.ts`, `web/src/app/events/[id]/course/page.tsx` + `actions.ts`, `web/src/lib/templates.ts`, `web/test/unit/templates.test.ts`

**Interfaces:**
- Consumes: `EventSettings`, `EventBundle` (Task 5), `createServerSupabase`, `getStaff` (Task 3).
- Produces:
  - `loadEvent(id: string): Promise<EventBundle>` in `db/events.ts` (one query per table, filtered `deleted_at is null`).
  - `softDelete(table, id)` / `restore(table, id)` server actions used by every Undo.
  - `TEMPLATES: { id; name; desc; settings: Partial<EventSettings>; available: boolean }[]` — `"Charity outing"` (4-person scramble, shotgun, 13:00, gross only `teamHandicap {method:"none"}`, `available: true`), `"Blank scramble"` (defaults, available), and the prototype's other six (`Club championship`, `Match play championship`, `Member-member`, `Member-guest`, `Weekly skins game`, `Stableford day`) with their prototype `desc` and `available: false` ("Coming soon").
  - Progress bar steps (from the prototype's `renderProgress`): Details · Field · Teams · Pairings · Scores · Finish, each done/not done from the bundle.

- [ ] **Step 1: Failing test** `templates.test.ts`: every available template's settings pass `EventSettings.parse`; exactly 2 are available; names match the prototype's `BUILTIN_TPLS` names.
- [ ] **Step 2:** FAIL → implement `templates.ts` → PASS.
- [ ] **Step 3:** Events page: upcoming first, then past; "Recently deleted" section with Restore; template cards (unavailable ones disabled with "Coming soon"); creating an event inserts `events` + `rounds` rows (one per `settings.rounds`) and goes to Details.
- [ ] **Step 4:** Details form: every `EventSettings` field with plain labels; validates with Zod and shows the Zod message next to the field; changing `rounds` adds/soft-deletes `rounds` rows. Custom percentages: three inputs rows (4-, 3-, 2-man). Prize amounts: list with Add place.
- [ ] **Step 5:** Course & tees: pick a saved course or create one; 18 par and 18 stroke-index inputs (validation: pars 3–6; SI is a permutation of 1–18 → "Stroke index must use each number 1 to 18 once."); tees with rating (50–80) and slope (55–155 → "Slope must be between 55 and 155."); optional per-tee pars/SI.
- [ ] **Step 6:** Manual check in the browser against `starter-test`: create from "Charity outing", edit details, set a course with two tees, delete the event and Undo it. Commit: `Events list, templates, event details, course and tees`.

### Task 9: Field, teams, flights

**Files:**
- Create: `web/src/app/events/[id]/field/page.tsx` + `actions.ts` + `ImportPanel.tsx`, `web/src/app/events/[id]/teams/page.tsx` + `actions.ts`

**Interfaces:**
- Consumes: `parseImport`, `guessMap`, `parseDelimited`, `sheetGroups` (Task 4); engine `drawBalancedTeams`, `listedTeams`, `scrambleFlights`, `scrambleTeamHandicap`, `effectiveIndex`; `toEngine` (Task 5).
- Produces: server actions `importPlayers(eventId, players: ImportedPlayer[], mode: "add" | "replace")`, `makeTeams(eventId, mode: "listed" | "balanced")`, `moveEntry(entryId, toTeamId | null)`, `setFlights(eventId)`, `setEntry(entryId, patch)`.

- [ ] **Step 1:** Field page: paste box + file upload (`.csv,.xlsx,.xls,.tsv,.txt`; xlsx read with SheetJS `read` → `sheet_to_json(header:1)`). After parsing, show the column-role dropdowns (pre-filled by `guessMap`), a preview with skipped rows and "N players have no handicap" / "N tees not recognized" notes, and "Add to field" / "Replace field". Golfers are matched to the club roster by GHIN number, else exact name (case-insensitive); new ones are added to `golfers`. "Add from roster" picker. Player rows: edit index, NH, tee; Remove with Undo; handicap limit warnings from the engine.
- [ ] **Step 2:** If the import had a group column and the event's team mode is `listed`, "Use the spreadsheet's teams" creates teams from `sheetGroups`.
- [ ] **Step 3:** Teams page: "Make balanced teams" / "Make teams in listed order" (engine functions; replacing existing teams shows Undo); alternates listed; move a player between teams; team handicap per team from `scrambleTeamHandicap`; "Split into flights" writes `teams.flight` from `scrambleFlights` (flight names from settings, default "A Flight", "B Flight"…); WD/DQ/NS status select.
- [ ] **Step 4:** Manual check: paste a 32-player list (some "Last, First", one "+1.2", one blank index) → 8 balanced teams, 2 flights; team handicaps equal the prototype's for the same list. Commit: `Field import, roster, balanced or listed teams, flights`.

### Task 10: Pairings screen

**Files:**
- Create: `web/src/app/events/[id]/pairings/page.tsx` + `actions.ts`

**Interfaces:**
- Consumes: `buildGroups`, `preEventCheck` (Task 7).
- Produces: actions `makePairings(eventId, roundNumber)`, `moveTeam(teamId, toGroupId)`, `setStart(groupId, start)`.

- [ ] **Step 1:** Round picker; "Make pairings" (if groups exist: replaced with Undo); for later rounds, "Same as round 1" copies groups. Groups listed by start with team names and players; Edit mode: move a team to another group or change a start.
- [ ] **Step 2:** Pre-event check panel lists `preEventCheck` problems (errors red, warnings amber) or "Ready to play".
- [ ] **Step 3:** Manual check: 8 teams shotgun → holes 1–8; change start type to tee times and remake → 8:00, 8:10…; Undo restores the shotgun. Commit: `Pairings screen with pre-event check`.

### Task 11: Enter cards

**Files:**
- Create: `web/src/components/HoleGrid.tsx`, `web/src/app/events/[id]/cards/page.tsx` + `actions.ts`

**Interfaces:**
- Consumes: `toEngine`; engine `holesInPlay`, `scrambleRound`, `strokesOnHole`, `scrambleTeamHandicap`.
- Produces: action `saveScore(roundId, teamId, hole, gross: number | null)` — calls `rpc('save_score', { …, p_screen: 'enter-cards' })` (Task 2); `setRoundMode(roundId, mode)`; `setTeamStatus(teamId, status)`.

- [ ] **Step 1:** Round and team pickers (team list shows "thru N"). `HoleGrid`: holes from `holesInPlay` (9 or 18), par row, stroke dots per hole from `strokesOnHole`, inputs 1–20; Out / In / Total live. Tab / Enter / arrow keys move to the next hole. Each input saves on blur; failed save → red box + "Not saved — retry" button; value stays.
- [ ] **Step 2:** Round mode select (Full, Front 9 only, Back 9 only, Called off) with a note "Scores already entered are kept." Team status select (Playing, WD, DQ, No show).
- [ ] **Step 3:** Manual check: enter 18 holes for a team, totals match `scrambleRound`; change round to Front 9 → back-nine inputs hidden but values still in the database; open the same card in two tabs, save hole 5 differently in each → last value shown after refresh, `score_log` has both. Commit: `Enter cards with live totals and round and team status`.

### Task 12: Leaderboard and Finish

**Files:**
- Create: `web/src/components/Board.tsx`, `web/src/app/events/[id]/board/page.tsx`, `web/src/app/events/[id]/finish/page.tsx` + `actions.ts`, `web/src/lib/money.ts`, `web/src/lib/csv.ts`, `web/test/unit/money.test.ts`, `web/test/unit/csv.test.ts`

**Interfaces:**
- Consumes: engine `scrambleBoards`, `scrambleLeaderboard`, `payoutAmounts`; `toEngine`.
- Produces: `formatMoney(n: number): string` (`83.3333 → "$83.33"`, `150 → "$150"`, `0.5 → "$0.50"`); `eventCsv(b: EventBundle): string` — sections "Field", "Teams", "Scores", "Gross", "Net", "Prizes", RFC 4180 quoting (port prototype `csvCell`).

- [ ] **Step 1: Failing tests:** `formatMoney` cases above; `eventCsv` on a 2-team bundle contains the header `Team,Position,To par,Gross,Net` and quotes a team name containing a comma.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Board page: per flight, gross and net side by side (net hidden when `scrambleBoards` returns only gross). Columns: Pos (`label`), Team, players, To par (`E`, `-3`, `+2`), Thru, Gross, Net. Auto-refresh every 15 s (live updates are piece 2).
- [ ] **Step 4:** Finish page: per flight and board, prize winners from `payoutAmounts(rows, settings.prizes)` with `formatMoney`; a team winning on both boards is listed on both. "Mark event final" sets `status = 'final'` (Undo). "Download CSV" uses `eventCsv`.
- [ ] **Step 5:** Manual check: two teams tied for 1st net with prizes 150/100/50 → each $125, next team 3rd $50. Commit: `Gross and net leaderboards, prizes and CSV export`.

### Task 13: Print pages

**Files:**
- Create: `web/src/app/events/[id]/print/page.tsx` (menu) and `print/pairings`, `print/cards`, `print/cart-signs`, `print/results`, `print/starter`, `print/alpha` pages; `web/src/app/print.css`

**Interfaces:**
- Consumes: `loadEvent`, `toEngine`, engine leaderboard/round functions, `fmtTime`.

- [ ] **Step 1:** Each page is a plain server page sized for US Letter with `@media print` rules and a "Print" button (`window.print()`), copying the content of the prototype's `tplPairings`, `tplCards` (one card per team, stroke dots), `tplCart` (team name, players, start), `tplResults`, `tplStarter`, `tplAlpha`. No logo or colors (piece 3c).
- [ ] **Step 2:** Manual check: open each in the browser's print preview next to the prototype's print of the same event; content matches, no page cut mid-card. Commit: `Print pages: pairings, scorecards, cart signs, results, starter, alphabetical`.

### Task 14: Settings: club name and backup import screen

**Files:**
- Create: `web/src/app/settings/page.tsx`, `web/src/app/settings/import/page.tsx` + `actions.ts`

**Interfaces:**
- Consumes: `readBackup` (Task 6).
- Produces: action `importBackup(text: string): Promise<{ imported: string[]; skipped: {name; reason}[] }>` — inserts each bundle as new rows (course saved per event as a new course named after the event's course or "Imported course"); names that already exist get " (restored)" like the prototype.

- [ ] **Step 1:** Settings page: club name edit; links to Staff and Import.
- [ ] **Step 2:** Import page: file picker (`.json`), result list "Imported: …" and "Not imported yet: … (match play isn't supported yet)". Errors show the `readBackup` message.
- [ ] **Step 3:** Manual check with a real backup Justin exports from the prototype (one scramble + one other format): scramble boards in the app match the prototype's. Commit: `Settings and prototype backup import`.

### Task 15: End-to-end test and deploy

**Files:**
- Create: `web/playwright.config.ts`, `web/e2e/outing.spec.ts`, `web/e2e/players.csv` (32 players, made up names, indexes −1.2 to 28.4, 2 tees)
- Modify: `CLAUDE.md` (Current focus → piece 2 next; commands), `docs/system-design.md` (Phase 1 ✅)

- [ ] **Step 1:** Playwright config uses `web/.env.test.local` (the `starter-test` project) and starts `next dev`. Before the run, a setup script signs up a fresh test user `e2e+<timestamp>@example.test` (works only because the test DB is reset first: `npx supabase db reset --linked` against `starter-test`).
- [ ] **Step 2: Write** `outing.spec.ts`: set up club → new event from "Charity outing", switch handicap to USGA → course (pars/SI from `scoring/test/scramble.test.ts`, one tee 72.0/113) → import `players.csv` → Make balanced teams (8) → Split into 2 flights → Make pairings (shotgun 1–8) → Pre-event check shows "Ready to play" → enter cards for all 8 teams (fixed scores in the spec file) → Board shows positions and to-par values equal to those computed in the test with the engine from the same data → Finish shows prize amounts equal to `payoutAmounts` → each of the 6 print pages loads with the team names visible.
- [ ] **Step 3:** Run `npm run e2e`: PASS.
- [ ] **Step 4: Justin (guided):** sign in to vercel.com with GitHub → Import `beevis2222/tournament-app` → Root Directory `web` → add the two `NEXT_PUBLIC_` variables for the `starter` project → Deploy. In Supabase → Authentication → URL Configuration, set Site URL to the Vercel address.
- [ ] **Step 5:** Open the live address, sign in, create a test event, delete it with Undo. Update docs; commit: `End-to-end outing test, deploy notes, phase 1 done`. Push the branch and open a PR.
