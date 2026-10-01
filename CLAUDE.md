# Starter: tournament-app

Starter is a golf tournament manager for private clubs, built to replace Golf Genius. The owner, Justin, is an assistant golf professional and not a software engineer. Explain choices in plain language, and treat his statements about how the club runs events as the source of truth.

## Where things are
- `docs/system-design.md`: stack, data model, screens, build order.
- `docs/rules/`: club rules per format, as confirmed by Justin. The code must follow these.
- `scoring/`: the scoring engine (pure TypeScript, no dependencies). Run `npm test` inside it.
- `prototype/fairway-tournament-prototype.html`: the working single-file prototype. It's a reference for screens and behavior. Don't edit it, and don't ship it.

## Rules
- Golf math must match `scoring/reference/golf_math.py` exactly. Use round half up, never banker's rounding.
- Store only gross strokes. Totals, net scores, points and standings are always calculated.
- Never invent a golf rule. If a situation isn't covered in `docs/rules/`, ask Justin, then write the answer there.
- Never silently destroy work. Destructive actions offer Undo.
- Use plain-language labels in the UI ("Enter cards", "Score on the course").
- Never commit secrets. API keys go in `.env`, which is ignored by git.

## Current focus
4-man scramble, gross and net, first. See `docs/rules/scramble.md`.
