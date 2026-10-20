# Starter: tournament-app

Starter is a golf tournament manager for private clubs, built to replace Golf Genius. The owner, Justin, is an assistant golf professional and not a software engineer. Explain choices in plain language, and treat his statements about how the club runs events as the source of truth.

## Where things are
- `docs/system-design.md`: stack, data model, screens, build order.
- `docs/rules/`: club rules per format, as confirmed by Justin. The code must follow these.
- `scoring/`: the scoring engine (pure TypeScript, no dependencies). Run `npm test` inside it.
- `web/`: the Starter app itself (a Next.js website). Run `npm install` once at the top folder, then `npm run dev` and open http://localhost:3000. `npm test` at the top folder runs the scoring tests and the app tests together.
- `prototype/fairway-tournament-prototype.html`: the working single-file prototype. It's a reference for screens and behavior. Don't edit it, and don't ship it.

## Rules
- Golf math must match `scoring/reference/golf_math.py` exactly. Use round half up, never banker's rounding.
- Store only gross strokes. Totals, net scores, points and standings are always calculated.
- Never invent a golf rule. If a situation isn't covered in `docs/rules/`, ask Justin, then write the answer there.
- Never silently destroy work. Destructive actions offer Undo.
- Use plain-language labels in the UI ("Enter cards", "Score on the course").
- Never commit secrets. API keys go in `.env`, which is ignored by git.

## Current focus
Piece 1 (the shop-only 4-man scramble) is built and tested end to end. It is not live yet. Next: deploy it (Vercel plus the Supabase sign-in address), then start piece 2 (live scoring from phones). The scramble rules are in `docs/rules/scramble.md`.

## Checking the whole app
- `npm test` at the top folder runs the scoring tests and the app tests.
- `npm run e2e -w web` runs one whole charity outing in a real browser: sign up, make a club, import 32 players, make teams, pair them, enter all the cards, then check the leaderboard, prizes and print pages against the scoring engine. It builds and starts the app itself on port 3100.
- The outing test only ever uses the **starter-test** Supabase project, never your real club. It refuses to start unless starter-test has no clubs, and it empties starter-test again when it finishes. If a run is killed halfway, empty it with `node web/e2e/clean-test-db.mjs clean`.
- The first time on a computer, run `npx playwright install chromium` inside `web/`. The Supabase command line must be linked to starter-test (`npx supabase link --project-ref adotnhqartwywzkhfbkt` inside `web/`).
