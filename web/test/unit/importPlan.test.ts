import { readBackup } from "@/lib/backup";
import { bundleToRows } from "@/lib/importPlan";

const pars = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5];
const proto = (name: string, playerNames = ["Ann Lee", "Bob Ray", "Cy Fox", "Di Moe"]) => ({
  id: "x",
  event: {
    name, format: "scramble", scoring: "net", rounds: 1, teamSize: 2, holesMode: "18", rmode: {},
    start: "shotgun", pars, si: pars.map((_, i) => i + 1),
    tees: [{ id: "blue", name: "Blue", rating: 68, slope: 120 }],
  },
  players: playerNames.map((n, i) => ({ id: `p${i}`, name: n, index: 10 + i, tee: "blue" })),
  pairings: {
    teams: [{ id: "t0", players: ["p0", "p1"], label: "A" }, { id: "t1", players: ["p2", "p3"], label: "B" }],
    rounds: [[{ id: "g0", teams: ["t0", "t1"], start: "1" }]],
  },
  cards: [{ t0: { team: [4, 5, null, 3] }, t1: { team: [4, 4] } }],
});
const bundle = (name = "Shop Scramble", players?: string[]) =>
  readBackup(JSON.stringify({ kind: "starter-backup", version: 1, events: [proto(name, players)] })).bundles[0];
const CLUB = "club-1";

test("rows keep the bundle's ids so references line up", () => {
  const b = bundle();
  const p = bundleToRows(b, CLUB, [], []);
  expect(p.eventName).toBe("Shop Scramble");
  expect(p.event).toMatchObject({ id: b.event.id, club_id: CLUB, status: "setup", course_id: b.course.id });
  expect(p.course).toMatchObject({ id: b.course.id, club_id: CLUB, name: "Imported course" });
  expect(p.tees.every((t) => t.course_id === b.course.id)).toBe(true);
  expect(p.entries.map((e) => e.tee_id)).toEqual(Array(4).fill(b.tees[0].id));
  expect(p.teamMembers).toHaveLength(4);
  expect(p.teamMembers.filter((m) => m.team_id === b.teams[0].id).map((m) => m.sort)).toEqual([0, 1]);
  expect(p.groups[0].round_id).toBe(b.rounds[0].id);
  expect(p.groupTeams.map((g) => [g.group_id, g.team_id, g.sort])).toEqual([
    [b.groups[0].id, b.teams[0].id, 0],
    [b.groups[0].id, b.teams[1].id, 1],
  ]);
  expect(p.scores).toHaveLength(5);
  expect(p.scores[0]).toEqual({ round_id: b.rounds[0].id, team_id: b.teams[0].id, hole: 1, gross: 4 });
});

test("a repeated event name gets (restored), ignoring case", () => {
  expect(bundleToRows(bundle(), CLUB, ["shop scramble "], []).eventName).toBe("Shop Scramble (restored)");
  expect(bundleToRows(bundle(), CLUB, ["Other"], []).event.name).toBe("Shop Scramble");
});

test("golfers match existing club golfers by name, else are created with the bundle's id", () => {
  const b = bundle();
  const p = bundleToRows(b, CLUB, [], [{ id: "g-existing", name: "ann LEE" }]);
  expect(p.entries[0].golfer_id).toBe("g-existing");
  expect(p.newGolfers.map((g) => g.name)).toEqual(["Bob Ray", "Cy Fox", "Di Moe"]);
  expect(p.entries[1].golfer_id).toBe(b.entries[1].golferId);
  expect(p.newGolfers[0]).toMatchObject({ id: b.entries[1].golferId, club_id: CLUB, index: 11 });
});

test("two entries with the same name share one new golfer", () => {
  const p = bundleToRows(bundle("X", ["Sam Poe", "sam poe", "Cy Fox", "Di Moe"]), CLUB, [], []);
  expect(p.newGolfers).toHaveLength(3);
  expect(p.entries[0].golfer_id).toBe(p.entries[1].golfer_id);
});
