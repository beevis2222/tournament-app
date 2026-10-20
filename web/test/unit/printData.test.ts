import { EventSettings, type EventBundle } from "@/lib/types";
import { alphaRows, lastFirst, pickRound, printGroups, roundText, starterSheet } from "@/lib/printData";

const si = [7, 1, 15, 9, 3, 11, 17, 5, 13, 8, 2, 16, 10, 4, 12, 18, 6, 14];

function bundle(course = true): EventBundle {
  const names = ["Bob Smith", "Al Zimmer", "Cy Adams", "Di Moore", "Ed Young", "Flo Hart", "Alt Player"];
  const entries = names.map((name, i) => ({ id: `e${i}`, golferId: `g${i}`, name, indexUsed: 10, nh: false, teeId: null, alternate: i === 6 }));
  const team = (n: number, ids: string[]) => ({ id: `t${n}`, label: `Team ${n}`, flight: null, status: null, sort: n, entryIds: ids });
  const group = (id: string, h: string | null, time: string | null, teamIds: string[], sort: number) => ({ id, roundId: "r1", startHole: h, startTime: time, label: "", sort, teamIds });
  return {
    event: { id: "ev", name: "Scramble", date: "2026-10-24", status: "live", settings: EventSettings.parse({ teamSize: 4 }) },
    course: course ? { id: "c", name: "Home", pars: si.map(() => 4), si } : { id: "", name: "", pars: si.map(() => 4), si },
    tees: [{ id: "tee", name: "White", rating: 70, slope: 113, pars: null, si: null }],
    entries,
    teams: [team(1, ["e0", "e1", "e6"]), team(2, ["e2", "e3"]), team(3, ["e4", "e5"])],
    rounds: [{ id: "r1", number: 1, mode: "full" }, { id: "r2", number: 2, mode: "full" }],
    groups: [
      group("g12", "12", null, ["t3"], 3),
      group("g2", "2", null, ["t2"], 2),
      group("gempty", "5", null, [], 4),
      group("g2b", "2B", null, ["t1"], 1),
    ],
    scores: [],
  };
}

test("last name first", () => {
  expect(lastFirst("Mary Ann Smith")).toBe("Smith, Mary Ann");
  expect(lastFirst("Cher")).toBe("Cher");
});

test("groups come in start order, skip empty groups and alternates", () => {
  const g = printGroups(bundle(), "r1");
  expect(g.map((x) => x.start)).toEqual(["2", "2B", "12"]);
  expect(g.map((x) => x.teams[0].label)).toEqual(["Team 2", "Team 1", "Team 3"]);
  expect(g[1].teams[0].players.map((p) => p.name)).toEqual(["Bob Smith", "Al Zimmer"]);
});

test("tee times sort by time", () => {
  const b = bundle();
  b.groups = [
    { id: "a", roundId: "r1", startHole: null, startTime: "13:05", label: "", sort: 1, teamIds: ["t1"] },
    { id: "b", roundId: "r1", startHole: null, startTime: "08:00", label: "", sort: 2, teamIds: ["t2"] },
  ];
  expect(printGroups(b, "r1").map((x) => x.start)).toEqual(["8:00 am", "1:05 pm"]);
});

test("handicaps and tees come from the engine, blank without a course", () => {
  const withCourse = printGroups(bundle(), "r1")[0].teams[0];
  expect(withCourse.players[0].tee).toBe("White");
  expect(withCourse.players[0].hcp).toMatch(/^-?\d+$/);
  expect(typeof withCourse.hcp).toBe("number");
  const none = printGroups(bundle(false), "r1")[0].teams[0];
  expect(none.hcp).toBeNull();
  expect(none.players[0]).toMatchObject({ hcp: "", tee: "" });
});

test("alpha list sorts by last name", () => {
  const rows = alphaRows(printGroups(bundle(), "r1"));
  expect(rows.map((r) => r.name)).toEqual(["Adams, Cy", "Hart, Flo", "Moore, Di", "Smith, Bob", "Young, Ed", "Zimmer, Al"]);
  expect(rows.find((r) => r.name === "Smith, Bob")!.start).toBe("2B");
});

test("starter sheet follows the starts and fills carts two at a time", () => {
  const s = starterSheet(printGroups(bundle(), "r1"));
  expect(s.groups.map((g) => g.start)).toEqual(["2", "2B", "12"]);
  expect(s.players).toBe(6);
  expect(s.carts).toBe(3);
  expect(s.groups.flatMap((g) => g.rows.map((r) => r.cart))).toEqual([1, 1, 2, 2, 3, 3]);
});

test("round picker falls back to the first round", () => {
  const b = bundle();
  expect(pickRound(b, "2")!.id).toBe("r2");
  expect(pickRound(b, "9")!.id).toBe("r1");
  expect(pickRound(b, undefined)!.id).toBe("r1");
  expect(roundText(b, 2)).toBe("Round 2");
  b.rounds = [b.rounds[0]];
  expect(roundText(b, 1)).toBe("");
});
