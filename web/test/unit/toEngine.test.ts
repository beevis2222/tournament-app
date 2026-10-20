import type { ScrambleEvent } from "@starter/scoring";
import { EventSettings, type EventBundle } from "@/lib/types";
import { hasCourse, toEngine } from "@/lib/toEngine";

const pars = [4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4];
const si = [7, 1, 15, 9, 3, 11, 17, 5, 13, 8, 2, 16, 10, 4, 12, 18, 6, 14];

function bundle(): EventBundle {
  return {
    event: {
      id: "ev1",
      name: "Shop Scramble",
      date: "2026-10-24",
      status: "live",
      settings: EventSettings.parse({ holes: "front", maxTeamHandicap: 12, limits: { cap: 20 } }),
    },
    course: { id: "c1", name: "Home", pars, si },
    tees: [
      { id: "t1", name: "White", rating: 70.1, slope: 125, pars: null, si: null },
      { id: "t2", name: "Red", rating: 68.2, slope: 118, pars: pars.map((p) => p), si },
    ],
    entries: [
      { id: "e1", golferId: "g1", name: "Ann", indexUsed: 5.4, nh: false, teeId: null, alternate: false },
      { id: "e2", golferId: "g2", name: "Bob", indexUsed: -1.2, nh: true, teeId: "t2", alternate: false },
      { id: "e3", golferId: "g3", name: "Cy", indexUsed: 12, nh: false, teeId: "t1", alternate: false },
      { id: "e4", golferId: "g4", name: "Di", indexUsed: 20, nh: false, teeId: null, alternate: false },
      { id: "e5", golferId: "g5", name: "Spare", indexUsed: 9, nh: false, teeId: null, alternate: true },
    ],
    teams: [
      { id: "tm2", label: "Team B", flight: null, status: null, sort: 2, entryIds: ["e3", "e4", "e5"] },
      { id: "tm1", label: "Team A", flight: 0, status: "WD", sort: 1, entryIds: ["e1", "e2"] },
    ],
    rounds: [
      { id: "r2", number: 2, mode: "back" },
      { id: "r1", number: 1, mode: "full" },
    ],
    groups: [],
    scores: [
      { roundId: "r1", teamId: "tm1", hole: 3, gross: 3 },
      { roundId: "r1", teamId: "tm1", hole: 1, gross: 4 },
      { roundId: "r1", teamId: "tm1", hole: 2, gross: null },
    ],
  };
}

test("converts a bundle into the engine's event", () => {
  const blank = Array(18).fill(null);
  const card = [...blank];
  card[0] = 4;
  card[2] = 3;
  const expected: ScrambleEvent = {
    teamHandicap: { method: "usga" },
    maxTeamHandicap: 12,
    course: {
      pars,
      si,
      tees: [
        { id: "t1", name: "White", rating: 70.1, slope: 125 },
        { id: "t2", name: "Red", rating: 68.2, slope: 118, pars, si },
      ],
    },
    players: [
      { id: "e1", name: "Ann", index: 5.4 },
      { id: "e2", name: "Bob", index: -1.2, nh: true, teeId: "t2" },
      { id: "e3", name: "Cy", index: 12, teeId: "t1" },
      { id: "e4", name: "Di", index: 20 },
    ],
    teams: [
      { id: "tm1", name: "Team A", playerIds: ["e1", "e2"], status: "WD", flight: 0 },
      { id: "tm2", name: "Team B", playerIds: ["e3", "e4"] },
    ],
    holes: "front",
    rounds: ["full", "back"],
    limits: { cap: 20 },
    scores: [{ tm1: card }, {}],
  };
  expect(toEngine(bundle())).toEqual(expected);
});

test("scores given out of order land at the right hole", () => {
  const out = toEngine(bundle());
  expect(out.scores[0].tm1[0]).toBe(4);
  expect(out.scores[0].tm1[1]).toBeNull();
  expect(out.scores[0].tm1[2]).toBe(3);
  expect(out.scores[0].tm1).toHaveLength(18);
});

test("a team with no scores gets no card", () => {
  const out = toEngine(bundle());
  expect("tm2" in out.scores[0]).toBe(false);
});

test("alternates are never in a team", () => {
  const out = toEngine(bundle());
  expect(out.teams.flatMap((t) => t.playerIds)).not.toContain("e5");
});

test("settings defaults", () => {
  expect(EventSettings.parse({})).toEqual({
    holes: "18",
    rounds: 1,
    teamSize: 4,
    teamMode: "balanced",
    teamHandicap: { method: "usga" },
    maxTeamHandicap: null,
    limits: {},
    flights: 1,
    flightNames: [],
    start: "shotgun",
    startTime: "08:00",
    interval: 10,
    prizes: [150, 100, 50],
  });
});

test("settings reject a bad interval", () => {
  expect(() => EventSettings.parse({ interval: 3 })).toThrow();
});

describe("no course chosen", () => {
  const noCourse = (): EventBundle => ({ ...bundle(), course: { id: "", name: "", pars: Array(18).fill(4), si: pars.map((_, i) => i + 1) } });
  it("toEngine refuses to run", () => {
    expect(() => toEngine(noCourse())).toThrow("Choose a course for this event first.");
  });
  it("hasCourse tells the two cases apart", () => {
    expect(hasCourse(noCourse())).toBe(false);
    expect(hasCourse(bundle())).toBe(true);
  });
});
