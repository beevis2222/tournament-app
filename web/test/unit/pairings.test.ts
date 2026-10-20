import { describe, it, expect } from "vitest";
import { buildGroups, startLabel, fmtTime, preEventCheck } from "@/lib/pairings";
import type { EventBundle } from "@/lib/types";
import { EventSettings } from "@/lib/types";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `t${i}`);
const shotgun = { start: "shotgun" as const, startTime: "08:00", interval: 10 };
const tee = { start: "teetimes" as const, startTime: "08:00", interval: 10 };
const lcg = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

describe("fmtTime", () => {
  it("formats 12-hour times", () => {
    expect(fmtTime("08:00")).toBe("8:00 am");
    expect(fmtTime("12:00")).toBe("12:00 pm");
    expect(fmtTime("13:05")).toBe("1:05 pm");
    expect(fmtTime("00:10")).toBe("12:10 am");
  });
});

describe("startLabel", () => {
  it("labels shotgun and tee times", () => {
    expect(startLabel(0, 20, shotgun)).toBe("1A");
    expect(startLabel(19, 20, shotgun)).toBe("2B");
    expect(startLabel(2, 18, shotgun)).toBe("3");
    expect(startLabel(1, 5, tee)).toBe("8:10 am");
  });
});

describe("buildGroups", () => {
  it("shotgun with 18 teams starts on holes 1..18, one team per group", () => {
    const g = buildGroups(ids(18), shotgun, () => 0.5);
    expect(g.map((x) => x.startHole)).toEqual(Array.from({ length: 18 }, (_, i) => String(i + 1)));
    expect(g.every((x) => x.startTime === null && x.teamIds.length === 1)).toBe(true);
  });
  it("shotgun with 20 teams uses A/B suffixes", () => {
    const h = buildGroups(ids(20), shotgun).map((x) => x.startHole);
    expect(h.slice(0, 18)).toEqual(Array.from({ length: 18 }, (_, i) => `${i + 1}A`));
    expect(h.slice(18)).toEqual(["1B", "2B"]);
  });
  it("tee times step by the interval", () => {
    const g = buildGroups(ids(3), tee);
    expect(g.map((x) => x.startTime)).toEqual(["08:00", "08:10", "08:20"]);
    expect(g.every((x) => x.startHole === null)).toBe(true);
  });
  it("wraps past midnight", () => {
    const g = buildGroups(ids(3), { ...tee, startTime: "23:50" });
    expect(g.map((x) => x.startTime)).toEqual(["23:50", "00:00", "00:10"]);
  });
  it("seeded rand gives a stable order that keeps every team", () => {
    const a = buildGroups(ids(8), shotgun, lcg(7)).map((x) => x.teamIds[0]);
    const b = buildGroups(ids(8), shotgun, lcg(7)).map((x) => x.teamIds[0]);
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual(ids(8));
    expect(a).not.toEqual(ids(8));
  });
});

function bundle(): EventBundle {
  const settings = EventSettings.parse({ teamSize: 4 });
  const entry = (id: string, name: string, nh = false) => ({
    id, golferId: id, name, indexUsed: 10, nh, teeId: null, alternate: false,
  });
  const team = (id: string, label: string, entryIds: string[], sort: number) => ({
    id, label, flight: null, status: null, sort, entryIds,
  });
  const grp = (id: string, teamIds: string[], startHole: string | null, sort: number) => ({
    id, roundId: "r1", startHole, startTime: null, label: "", sort, teamIds,
  });
  return {
    event: { id: "e", name: "E", date: "2026-10-19", status: "setup", settings },
    course: { id: "c", name: "C", pars: Array(18).fill(4), si: Array.from({ length: 18 }, (_, i) => i + 1) },
    tees: [],
    entries: [
      entry("a", "Ann"), entry("b", "Bob"), entry("c", "Cy"), entry("d", "Di", true),
      entry("e", "Ed"), entry("f", "Flo"), entry("g", "Gus"),
      entry("h", "Hal"), entry("i", "Ivy"), entry("j", "Jo"), entry("k", "Kit"),
    ],
    teams: [
      team("t1", "Team 1", ["a", "b", "c", "d"], 0),
      team("t2", "Team 2", ["e", "f", "g"], 1),
      team("t3", "Team 3", ["h", "i", "j", "k"], 2),
    ],
    rounds: [{ id: "r1", number: 1, mode: "scramble" as never }],
    groups: [grp("g1", ["t1"], "1", 0), grp("g2", ["t2"], "1", 1)],
    scores: [],
  };
}

describe("preEventCheck", () => {
  it("reports NH, short team, unstarted team and duplicate starts", () => {
    const p = preEventCheck(bundle());
    expect(p).toHaveLength(4);
    expect(p).toEqual(
      expect.arrayContaining([
        { level: "warning", text: "Di has no handicap index." },
        { level: "warning", text: "Team 2 has only 3 players." },
        { level: "error", text: "Team 3 has no starting hole or time." },
        { level: "error", text: "Two groups start at 1 in round 1." },
      ]),
    );
  });
  it("does not count an empty group sharing a start as a duplicate", () => {
    const b = bundle();
    b.groups = [
      { id: "g1", roundId: "r1", startHole: "1", startTime: null, label: "", sort: 0, teamIds: ["t1"] },
      { id: "g2", roundId: "r1", startHole: "1", startTime: null, label: "", sort: 1, teamIds: [] },
    ];
    expect(preEventCheck(b).map((x) => x.text)).not.toContain("Two groups start at 1 in round 1.");
  });
  it("flags missing pars", () => {
    const b = bundle();
    b.course.pars = [];
    expect(preEventCheck(b)).toContainEqual({ level: "error", text: "No course pars set.", code: "no-course" });
  });
});
