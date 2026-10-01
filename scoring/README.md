# Starter scoring engine

All of Starter's golf math lives here: handicaps, strokes, net scores, leaderboards and prize splits. It's plain TypeScript with no screens, database or outside packages, so the website, the phones and the TV all share exactly the same rules.

So far it covers the **scramble**. See `docs/rules/scramble.md` for the club rules it follows.

## Run the tests
You need Node.js 22.18 or newer. In this folder, run:

```
npm test
```

There are two kinds of tests:
- `test/scramble.test.ts` has hand-worked examples of each club rule.
- `test/parity.test.ts` runs 400 random scramble events through the engine and checks every number (about 75,000 values) against `reference/golf_math.py`. That's an independent calculator, written separately, that also verified the prototype.

## Files
| File | What it does |
|---|---|
| `src/handicap.ts` | Course handicap, limits, which holes count, strokes per hole, flights |
| `src/scramble.ts` | Team handicap, round and event totals, gross/net leaderboards, team draws |
| `src/prizes.ts` | Prize money with ties sharing |
| `src/prototype.ts` | Reads events from the prototype's backup file |
| `reference/` | The independent calculator plus the script that builds the test cases |

## Rules for changing this code
1. Round half up (`Math.floor(x + 0.5)`), never banker's rounding.
2. Only store gross strokes. Everything else is calculated.
3. If a test against `golf_math.py` fails, the engine is wrong, unless Justin changed a rule. In that case, update `docs/rules/` first.
4. After changing `reference/make_scramble_fixtures.py`, run `npm run fixtures` (needs Python 3) and commit the new test file.
