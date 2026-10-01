// Parity with the independent calculator (reference/golf_math.py).
// 400 random scramble events: plus handicaps, NH players, custom tees,
// 9-hole events, shortened and called-off rounds, caps and partner gaps,
// unfinished cards. Every number must match exactly.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  courseHandicap,
  fromPrototypeScramble,
  holesInPlay,
  scrambleRound,
  scrambleTeamHandicap,
  strokesOnHole,
} from "../src/index.ts";

const fixtures = JSON.parse(readFileSync(new URL("./fixtures/scramble-parity.json", import.meta.url), "utf8"));

test(`scramble parity: ${fixtures.cases.length} events match golf_math.py`, () => {
  let checks = 0;
  for (const { event, expected } of fixtures.cases) {
    const ev = fromPrototypeScramble(event);
    const byId = new Map(ev.players.map((p) => [p.id, p]));
    for (const team of ev.teams) {
      const want = expected[team.id];
      const where = `${event.id} ${team.id}`;
      team.playerIds.forEach((id, i) => {
        assert.ok(Math.abs(courseHandicap(ev.course, byId.get(id)!, ev.limits, team, byId) - want.courseHandicaps[i]) < 1e-9, `${where} course hcp ${id}`);
        checks++;
      });
      assert.equal(scrambleTeamHandicap(ev, team), want.handicap18, `${where} team hcp`);
      checks++;
      ev.rounds.forEach((mode, r) => {
        const got = scrambleRound(ev, team, r);
        const w = want.rounds[r];
        const at = `${where} round ${r + 1}`;
        assert.equal(got.handicap, w.handicap, `${at} handicap`);
        assert.equal(got.thru, w.thru, `${at} thru`);
        assert.equal(got.gross, w.gross, `${at} gross`);
        assert.equal(got.grossToPar, w.grossToPar, `${at} gross to par`);
        assert.equal(got.netToPar, w.netToPar, `${at} net to par`);
        checks += 5;
        const holes = holesInPlay(ev.holes, mode);
        for (const h of holes) {
          assert.equal(strokesOnHole(got.handicap, h, holes, ev.course.si), w.strokes[h], `${at} strokes hole ${h + 1}`);
          checks++;
        }
      });
    }
  }
  console.log(`  ${checks} values checked`);
});
