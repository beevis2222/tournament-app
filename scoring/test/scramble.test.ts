// Hand-worked examples of the club's scramble rules (docs/rules/scramble.md).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  drawBalancedTeams,
  listedTeams,
  payout,
  scrambleBoards,
  scrambleFlights,
  scrambleLeaderboard,
  scrambleRound,
  scrambleTeamHandicap,
  strokesOnHole,
  type Player,
  type ScrambleEvent,
} from "../src/index.ts";

const PARS = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 3, 4, 5, 4, 4, 3, 5, 4]; // par 72
const SI = [7, 11, 15, 1, 5, 13, 17, 9, 3, 8, 16, 4, 2, 12, 10, 18, 6, 14];
// Rating 72.0 / slope 113 on a par 72 makes course handicap = index exactly.
const course = { pars: PARS, si: SI, tees: [{ id: "w", name: "White", rating: 72, slope: 113 }] };

const p = (id: string, index: number, extra: Partial<Player> = {}): Player => ({ id, name: id, index, ...extra });

function event(overrides: Partial<ScrambleEvent> = {}): ScrambleEvent {
  return {
    course,
    players: [p("a", 4), p("b", 10), p("c", 16), p("d", 22), p("e", 0), p("f", 0), p("g", 0), p("h", 0)],
    teams: [
      { id: "t1", name: "Team 1", playerIds: ["d", "b", "a", "c"] },
      { id: "t2", name: "Team 2", playerIds: ["e", "f", "g", "h"] },
    ],
    holes: "18",
    rounds: ["full"],
    scores: [{}],
    ...overrides,
  };
}
const card = (fill: (h: number) => number | null) => Array.from({ length: 18 }, (_, h) => fill(h));

test("team handicap: 25/20/15/10% of course handicaps sorted low to high", () => {
  // 4x25% + 10x20% + 16x15% + 22x10% = 1 + 2 + 2.4 + 2.2 = 7.6 -> 8
  assert.equal(scrambleTeamHandicap(event(), event().teams[0]), 8);
});

test("team handicap: 3- and 2-person teams use their own weights", () => {
  const ev = event({ teams: [{ id: "x", name: "x", playerIds: ["a", "b", "c"] }, { id: "y", name: "y", playerIds: ["a", "b"] }] });
  assert.equal(scrambleTeamHandicap(ev, ev.teams[0]), 4); // 0.8 + 1.5 + 1.6 = 3.9 -> 4
  assert.equal(scrambleTeamHandicap(ev, ev.teams[1]), 3); // 1.4 + 1.5 = 2.9 -> 3
});

test("team handicap: halved before rounding on a 9-hole round", () => {
  const ev = event({ rounds: ["front"] });
  assert.equal(scrambleTeamHandicap(ev, ev.teams[0], 0), 4); // 7.6 / 2 = 3.8 -> 4
});

test("round half up, never banker's rounding", () => {
  const team = { id: "t", name: "t", playerIds: ["a", "b", "c", "d"] };
  // Sorted 0, 0, 0, 25 -> 25 x 10% = 2.5 -> 3 (banker's rounding would say 2)
  assert.equal(scrambleTeamHandicap(event({ players: [p("a", 25), p("b", 0), p("c", 0), p("d", 0)] }), team), 3);
  // 2x25% + 2x20% + 3x15% + 5x10% = 1.85 -> 2
  assert.equal(scrambleTeamHandicap(event({ players: [p("a", 2), p("b", 2), p("c", 3), p("d", 5)] }), team), 2);
});

test("strokes fall on the hardest holes; plus teams give back on the easiest", () => {
  const holes = Array.from({ length: 18 }, (_, i) => i);
  const got = holes.filter((h) => strokesOnHole(8, h, holes, SI) === 1).map((h) => SI[h]).sort((a, b) => a - b);
  assert.deepEqual(got, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(strokesOnHole(-1, SI.indexOf(18), holes, SI), -1);
  assert.equal(strokesOnHole(-1, SI.indexOf(17), holes, SI), 0);
});

test("a round: gross, net and to-par", () => {
  const ev = event({ scores: [{ t1: card((h) => PARS[h] - (h < 6 ? 1 : 0)) }] }); // six birdies
  const r = scrambleRound(ev, ev.teams[0], 0);
  assert.equal(r.gross, 66);
  assert.equal(r.grossToPar, -6);
  assert.equal(r.net, 58); // 8 strokes
  assert.equal(r.netToPar, -14);
  assert.equal(r.complete, true);
});

test("a called-off round counts for nothing", () => {
  const ev = event({ rounds: ["full", "called_off"], scores: [{ t1: card((h) => PARS[h]) }, { t1: card(() => 2) }] });
  const r = scrambleRound(ev, ev.teams[0], 1);
  assert.equal(r.thru, 0);
  assert.equal(r.holes, 0);
});

test("gross and net are separate boards; the same team can win both", () => {
  const ev = event({ scores: [{ t1: card((h) => PARS[h] - 1), t2: card((h) => PARS[h]) }] });
  const gross = scrambleLeaderboard(ev, "gross");
  const net = scrambleLeaderboard(ev, "net");
  assert.equal(gross[0].total.team.id, "t1");
  assert.equal(net[0].total.team.id, "t1");
  assert.equal(gross[0].label, "1");
});

test("ties share the position, no countback", () => {
  const ev = event({
    teams: [
      { id: "t1", name: "1", playerIds: ["e", "f", "g", "h"] },
      { id: "t2", name: "2", playerIds: ["e", "f", "g", "h"] },
      { id: "t3", name: "3", playerIds: ["e", "f", "g", "h"] },
    ],
    // t1 and t2 both -2 but in different holes; t3 even
    scores: [{ t1: card((h) => PARS[h] - (h < 2 ? 1 : 0)), t2: card((h) => PARS[h] - (h > 15 ? 1 : 0)), t3: card((h) => PARS[h]) }],
  });
  const board = scrambleLeaderboard(ev, "gross");
  assert.deepEqual(board.map((r) => r.label), ["T1", "T1", "3"]);
});

test("WD/DQ/NS teams drop to the bottom and can't win; unstarted teams sit above them", () => {
  const ev = event({
    teams: [
      { id: "t1", name: "1", playerIds: ["a", "b", "c", "d"], status: "WD" },
      { id: "t2", name: "2", playerIds: ["e", "f", "g", "h"] },
      { id: "t3", name: "3", playerIds: ["e", "f", "g", "h"] },
    ],
    scores: [{ t1: card((h) => PARS[h] - 1), t2: card((h) => (h < 9 ? PARS[h] : null)) }],
  });
  const board = scrambleLeaderboard(ev, "gross");
  assert.deepEqual(board.map((r) => [r.total.team.id, r.label, r.eligible]), [["t2", "1", true], ["t3", "", true], ["t1", "WD", false]]);
});

test("prizes: tied teams split the combined money for the places they cover", () => {
  const money = payout(
    [{ id: "a", position: 1, eligible: true }, { id: "b", position: 1, eligible: true }, { id: "c", position: 3, eligible: true }, { id: "d", position: 4, eligible: true }],
    1000,
    [50, 30, 20],
  );
  assert.equal(money.get("a"), 400); // (500 + 300) / 2
  assert.equal(money.get("b"), 400);
  assert.equal(money.get("c"), 200);
  assert.equal(money.has("d"), false);
  const total = [...money.values()].reduce((x, y) => x + y, 0);
  assert.equal(total, 1000);
});

test("prizes: three tied for 2nd split 2nd + 3rd + 4th", () => {
  const money = payout(
    [{ id: "a", position: 1, eligible: true }, { id: "b", position: 2, eligible: true }, { id: "c", position: 2, eligible: true }, { id: "d", position: 2, eligible: true }],
    600,
    [50, 30, 20],
  );
  assert.equal(money.get("a"), 300);
  assert.equal(money.get("b"), 100); // (180 + 120 + 0) / 3
});

test("balanced draw: snake by handicap, leftovers are alternates", () => {
  const players = ["p0", "p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"].map((id, i) => p(id, i));
  const { teams, alternates } = drawBalancedTeams(players, 4);
  assert.deepEqual(teams, [["p0", "p3", "p4", "p7"], ["p1", "p2", "p5", "p6"]]);
  assert.deepEqual(alternates, ["p8"]);
});

test("listed teams: four at a time in signup order", () => {
  const players = ["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => p(id, 10));
  assert.deepEqual(listedTeams(players, 4).teams, [["a", "b", "c", "d"], ["e", "f", "g", "h"]]);
});

test("flights by team handicap, lowest first, extras to the top flights", () => {
  const players = Array.from({ length: 20 }, (_, i) => p("p" + i, i));
  const teams = Array.from({ length: 5 }, (_, t) => ({ id: "t" + t, name: "t" + t, playerIds: [0, 1, 2, 3].map((k) => "p" + (t * 4 + k)) }));
  const flights = scrambleFlights(event({ players, teams }), 2);
  assert.deepEqual(flights, [["t0", "t1", "t2"], ["t3", "t4"]]);
});

// ---- Team handicap setting (all four options) ----
// Course handicaps 4, 10, 16, 22 (rating 72 / slope 113 / par 72 = index).
const four = { id: "t", name: "t", playerIds: ["d", "b", "a", "c"] };

test("setting: no setting means USGA, same as choosing it", () => {
  assert.equal(scrambleTeamHandicap(event(), four), 8);
  assert.equal(scrambleTeamHandicap(event({ teamHandicap: { method: "usga" } }), four), 8);
});

test("setting: custom 20/15/10/5", () => {
  // 0.8 + 1.5 + 1.6 + 1.1 = 5.0 -> 5
  const ev = event({ teamHandicap: { method: "custom", percents: { 4: [20, 15, 10, 5] } } });
  assert.equal(scrambleTeamHandicap(ev, four), 5);
});

test("setting: custom 25/20/15/10 gives exactly the USGA answer", () => {
  const ev = event({ teamHandicap: { method: "custom", percents: { 4: [25, 20, 15, 10] } } });
  for (const set of [[4, 10, 16, 22], [0, 0, 0, 25], [2, 2, 3, 5], [-1.3, 7.7, 12.2, 31.9]]) {
    const players = set.map((ix, i) => p("x" + i, ix));
    const team = { id: "t", name: "t", playerIds: players.map((x) => x.id) };
    assert.equal(scrambleTeamHandicap({ ...ev, players }, team), scrambleTeamHandicap(event({ players }), team));
  }
});

test("setting: custom for 4-man only; a 2-man team falls back to USGA 35/15", () => {
  const ev = event({ teamHandicap: { method: "custom", percents: { 4: [20, 15, 10, 5] } } });
  assert.equal(scrambleTeamHandicap(ev, { id: "x", name: "x", playerIds: ["a", "b"] }), 3); // 1.4 + 1.5 = 2.9
  const ev2 = event({ teamHandicap: { method: "custom", percents: { 4: [20, 15, 10, 5], 2: [25, 10] } } });
  assert.equal(scrambleTeamHandicap(ev2, { id: "x", name: "x", playerIds: ["a", "b"] }), 2); // 1.0 + 1.0
});

test("setting: percent of combined handicaps", () => {
  // (4 + 10 + 16 + 22) = 52 x 10% = 5.2 -> 5 ; x 15% = 7.8 -> 8
  assert.equal(scrambleTeamHandicap(event({ teamHandicap: { method: "combined", percent: 10 } }), four), 5);
  assert.equal(scrambleTeamHandicap(event({ teamHandicap: { method: "combined", percent: 15 } }), four), 8);
});

test("setting: percent of combined is halved for a 9-hole round", () => {
  const ev = event({ rounds: ["front"], teamHandicap: { method: "combined", percent: 10 } });
  assert.equal(scrambleTeamHandicap(ev, four, 0), 3); // 5.2 / 2 = 2.6 -> 3
});

test("setting: none means no strokes, net equals gross, and only the gross board shows", () => {
  const ev = event({ teamHandicap: { method: "none" }, scores: [{ t1: card((h) => PARS[h]) }] });
  assert.equal(scrambleTeamHandicap(ev, ev.teams[0]), 0);
  const r = scrambleRound(ev, ev.teams[0], 0);
  assert.equal(r.net, r.gross);
  assert.deepEqual(scrambleBoards(ev), ["gross"]);
  assert.deepEqual(scrambleBoards(event()), ["gross", "net"]);
});
