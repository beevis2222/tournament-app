/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fromPrototypeScramble, scrambleRound, scrambleTeamHandicap } from "@starter/scoring";
import { readBackup } from "@/lib/backup";
import { toEngine } from "@/lib/toEngine";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../scoring/test/fixtures/scramble-parity.json", import.meta.url)), "utf8"),
) as { cases: { event: any }[] };

const wrap = (events: unknown[]) => JSON.stringify({ kind: "starter-backup", version: 1, events });

test("importing all 400 prototype scrambles scores identically to the engine's own reader", () => {
  expect(fixture.cases).toHaveLength(400);
  for (const [i, c] of fixture.cases.entries()) {
    const result = readBackup(wrap([c.event]));
    expect(result.skipped).toEqual([]);
    const got = toEngine(result.bundles[0]);
    const want = fromPrototypeScramble(c.event);
    expect(got.teams.length, `case ${i} team count`).toBe(want.teams.length);
    for (const wt of want.teams) {
      const gt = got.teams.find((t) => t.name === wt.name)!;
      expect(gt, `case ${i} team ${wt.name}`).toBeDefined();
      expect(scrambleTeamHandicap(got, gt), `case ${i} ${wt.name} handicap`).toBe(scrambleTeamHandicap(want, wt));
      for (let r = 0; r < want.rounds.length; r++) {
        const a = scrambleRound(got, gt, r);
        const b = scrambleRound(want, wt, r);
        expect(a, `case ${i} ${wt.name} round ${r}`).toEqual(b);
      }
    }
  }
});

test("a file that is not a backup is refused with a plain message", () => {
  expect(() => readBackup("{}")).toThrow("That file isn't a backup from this app.");
  expect(() => readBackup("not json")).toThrow("That file isn't a backup from this app.");
});

test("non-scramble events are skipped with a reason", () => {
  const r = readBackup(wrap([{ id: "m", event: { name: "Cup", format: "matchplay" } }]));
  expect(r.bundles).toHaveLength(0);
  expect(r.skipped).toEqual([{ name: "Cup", reason: "matchplay isn't supported yet" }]);
});

test("start settings, flights, statuses, prizes and groups come across", () => {
  const pars = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5];
  const ev = {
    id: "x",
    event: {
      name: "Flighted", format: "scramble", scoring: "net", rounds: 2, teamSize: 2, holesMode: "18", rmode: {},
      flights: 2, flightNames: ["Gold", "Silver"], start: "teetimes", startTime: "07:30", interval: 9,
      prizes: { on: true, purse: 300, split: "50,30,20" }, pars, si: pars.map((_, i) => i + 1),
      tees: [{ id: "blue", name: "Blue", rating: 68, slope: 120 }],
    },
    players: [1, 2, 3, 4].map((n) => ({ id: `p${n}`, name: `P${n}`, index: 10, tee: "blue" })),
    pairings: {
      teams: [
        { id: "t0", players: ["p1", "p2"], label: "A", flight: 0 },
        { id: "t1", players: ["p3", "p4"], label: "B", flight: 1 },
      ],
      status: { t0: "WD", t1: "DQ" },
      rounds: [
        [{ id: "r0g0", flight: 0, teams: ["t0"], start: "1" }, { id: "r0g1", flight: 1, teams: ["t1"], start: "10" }],
        [{ id: "r1g0", flight: 0, teams: ["t0"], start: "8:00am" }, { id: "r1g1", flight: 1, teams: ["t1"], start: "1:30pm" }],
      ],
    },
    cards: [{ t0: { team: [4, "x", "", null, 5, ...Array(13).fill(null)] } }, {}],
  };
  const b = readBackup(wrap([ev])).bundles[0];
  expect(b.event.settings).toMatchObject({
    start: "teetimes", startTime: "07:30", interval: 9, flights: 2, flightNames: ["Gold", "Silver"], prizes: [150, 90, 60], teamSize: 2,
  });
  expect(b.teams.map((t) => [t.label, t.flight, t.status])).toEqual([["A", 0, "WD"], ["B", 1, "DQ"]]);
  const [r1, r2] = b.rounds;
  const g = (rid: string) => b.groups.filter((x) => x.roundId === rid).map((x) => [x.startHole, x.startTime]);
  expect(g(r1.id)).toEqual([["1", null], ["10", null]]);
  expect(g(r2.id)).toEqual([[null, "08:00"], [null, "13:30"]]);
  expect(b.scores.map((s) => [s.hole, s.gross])).toEqual([[1, 4], [5, 5]]);
});

test("a team status that is not WD, DQ or NS is treated as playing instead of failing the event", () => {
  const pars = Array(18).fill(4);
  const ev = {
    id: "s",
    event: { name: "Odd status", format: "scramble", scoring: "net", rounds: 1, teamSize: 2, holesMode: "18", rmode: {}, pars, si: pars.map((_: number, i: number) => i + 1), tees: [] },
    players: [1, 2].map((n) => ({ id: `p${n}`, name: `P${n}`, index: 10 })),
    pairings: { teams: [{ id: "t0", players: ["p1", "p2"], label: "A" }], status: { t0: "withdrawn" }, rounds: [[]] },
    cards: [{}],
  };
  const r = readBackup(wrap([ev]));
  expect(r.skipped).toEqual([]);
  expect(r.bundles[0].teams.map((t) => t.status)).toEqual([null]);
});
