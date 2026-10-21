import { describe, it, expect } from "vitest";
import { drawBalancedTeams, scrambleFlights, scrambleTeamHandicap } from "@starter/scoring";
import { planImport } from "@/lib/fieldImport";
import { flightAssignments, flightName, limitWarnings, planTeams, teamHandicaps } from "@/lib/teamPlan";
import { toEngine } from "@/lib/toEngine";
import { EventSettings, type EventBundle } from "@/lib/types";
import { guessMap, parseDelimited, parseImport, type ImportedPlayer } from "@/lib/import/parse";

const pars = [4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4];
const si = [7, 1, 15, 9, 3, 11, 17, 5, 13, 8, 2, 16, 10, 4, 12, 18, 6, 14];
const tees = [
  { id: "t1", name: "White" },
  { id: "t2", name: "Red" },
];
let n = 0;
const newId = () => `new${++n}`;
const player = (over: Partial<ImportedPlayer>): ImportedPlayer => ({
  name: "A B", index: 10, nh: false, teeName: null, teeUnknown: false, ghin: null, group: null, row: 0, ...over,
});

describe("planImport", () => {
  it("matches by GHIN, then by exact name, and creates the rest", () => {
    const roster = [
      { id: "g1", name: "Ann Lee", ghin: "123" },
      { id: "g2", name: "Bob Ray", ghin: null },
      { id: "g3", name: "Cy Dee", ghin: "999" },
    ];
    const r = planImport(
      [
        player({ name: "Annie Lee", ghin: "123" }), // GHIN beats a different name
        player({ name: "  bob RAY " }), // name, case and spaces ignored
        player({ name: "Cy Dee", ghin: "555" }), // same name, different GHIN: a different person
        player({ name: "New One", index: 4.2, teeName: "Red" }),
      ],
      roster,
      tees,
      new Set(),
      newId,
    );
    expect(r.golferIds.slice(0, 2)).toEqual(["g1", "g2"]);
    expect(r.newGolfers.map((g) => g.name)).toEqual(["Cy Dee", "New One"]);
    expect(r.entries[3]).toMatchObject({ index: 4.2, teeId: "t2", nh: false });
  });

  it("uses the first tee for blank or unknown tees, null with no tees, and stores NH as index 0", () => {
    const [a] = planImport([player({ nh: true, index: 0, teeName: null })], [], tees, new Set(), newId).entries;
    expect(a).toMatchObject({ teeId: "t1", nh: true, index: 0 });
    const [b] = planImport([player({})], [], [], new Set(), newId).entries;
    expect(b?.teeId).toBeNull();
  });

  it("skips golfers already in the field and repeated rows", () => {
    const roster = [{ id: "g1", name: "Ann Lee", ghin: null }];
    const r = planImport(
      [player({ name: "Ann Lee" }), player({ name: "Dup Name" }), player({ name: "Dup Name" })],
      roster,
      tees,
      new Set(["g1"]),
      newId,
    );
    expect(r.entries.map((e) => e !== null)).toEqual([false, true, false]);
    expect(r.newGolfers).toHaveLength(1);
  });
});

function bundle(count: number, settings: Record<string, unknown> = {}): EventBundle {
  const entries = Array.from({ length: count }, (_, i) => ({
    id: `e${i}`,
    golferId: `g${i}`,
    name: `P${i}`,
    indexUsed: ((i * 7) % 30) + (i % 3) / 10,
    nh: i === 5,
    teeId: i % 2 ? "t2" : "t1",
    alternate: false,
  }));
  return {
    event: { id: "ev", name: "X", date: "2026-10-24", status: "setup", settings: EventSettings.parse(settings) },
    course: { id: "c", name: "Home", pars, si },
    tees: [
      { id: "t1", name: "White", rating: 70.1, slope: 125, pars: null, si: null },
      { id: "t2", name: "Red", rating: 68.2, slope: 118, pars: null, si: null },
    ],
    entries,
    teams: [],
    rounds: [{ id: "r1", number: 1, mode: "full" }],
    groups: [],
    scores: [],
  };
}

function withTeams(b: EventBundle): EventBundle {
  const plan = planTeams(b, "balanced");
  return {
    ...b,
    entries: b.entries.map((e) => ({ ...e, alternate: plan.alternates.includes(e.id) })),
    teams: plan.teams.map((t, i) => ({ id: `tm${i}`, label: t.label, flight: null, status: null, sort: i, entryIds: t.entryIds })),
  };
}

describe("planTeams", () => {
  it("32 players make 8 balanced teams matching the engine's snake draft", () => {
    const b = bundle(32);
    const plan = planTeams(b, "balanced");
    expect(plan.teams).toHaveLength(8);
    expect(plan.teams.map((t) => t.label)).toEqual(Array.from({ length: 8 }, (_, i) => `Team ${i + 1}`));
    const direct = drawBalancedTeams(b.entries.map((e) => ({ id: e.id, name: e.name, index: e.indexUsed })), 4);
    expect(plan.teams.map((t) => t.entryIds)).toEqual(direct.teams);
    expect(plan.alternates).toEqual([]);
  });
  it("leftovers become alternates; listed order follows entry order", () => {
    const b = bundle(10);
    const listed = planTeams(b, "listed");
    expect(listed.teams.map((t) => t.entryIds)).toEqual([
      ["e0", "e1", "e2", "e3"],
      ["e4", "e5", "e6", "e7"],
    ]);
    expect(listed.alternates).toEqual(["e8", "e9"]);
    expect(planTeams(b, "balanced").alternates).toHaveLength(2);
  });
  it("sheet groups keep their labels; players outside them are alternates", () => {
    const plan = planTeams(bundle(6), "listed", [
      { label: "Pro-Am 1", entryIds: ["e0", "e1"] },
      { label: "Pro-Am 2", entryIds: ["e2"] },
    ]);
    expect(plan.teams.map((t) => t.label)).toEqual(["Pro-Am 1", "Pro-Am 2"]);
    expect(plan.alternates).toEqual(["e3", "e4", "e5"]);
  });
});

describe("team handicaps and flights", () => {
  it("team handicaps equal the engine's result for the same teams", () => {
    const b = withTeams(bundle(32));
    const ev = toEngine(b);
    const got = teamHandicaps(b);
    expect(got.size).toBe(8);
    for (const t of ev.teams) expect(got.get(t.id)).toBe(scrambleTeamHandicap(ev, t));
  });
  it("flights come from scrambleFlights, lowest handicaps first", () => {
    const b = withTeams(bundle(32, { flights: 2 }));
    const direct = scrambleFlights(toEngine(b), 2);
    const got = flightAssignments(b);
    direct.forEach((ids, f) => ids.forEach((id) => expect(got.get(id)).toBe(f)));
    expect(direct.map((f) => f.length)).toEqual([4, 4]);
  });
  it("flight names default to A Flight, B Flight", () => {
    expect(flightName([], 0)).toBe("A Flight");
    expect(flightName(["Low", " "], 1)).toBe("B Flight");
    expect(flightName(["Low"], 0)).toBe("Low");
  });
});

describe("limitWarnings", () => {
  it("warns about players over the cap", () => {
    const b = bundle(4, { limits: { cap: 8 } });
    const w = limitWarnings(b);
    expect([...w.keys()].every((id) => b.entries.find((e) => e.id === id)!.indexUsed > 8)).toBe(true);
    expect(w.size).toBeGreaterThan(0);
  });
  it("warns about a big gap on a team, in flag mode too", () => {
    expect(limitWarnings(withTeams(bundle(4, { limits: { gap: 3, gapMode: "flag" } }))).size).toBeGreaterThan(0);
    expect(limitWarnings(withTeams(bundle(4, { limits: { gap: 99 } }))).size).toBe(0);
  });
  it("is empty with no limits", () => {
    expect(limitWarnings(bundle(8)).size).toBe(0);
  });
});

describe("32-player paste", () => {
  it("handles Last, First names, +1.2 and a blank index", () => {
    const lines = ["Name,Index"];
    for (let i = 0; i < 32; i++) {
      const idx = i === 3 ? "+1.2" : i === 7 ? "" : String(5 + i / 2);
      lines.push(i === 0 ? `"Smith, Joe",${idx}` : `Player ${i},${idx}`);
    }
    const rows = parseDelimited(lines.join("\n"));
    const { header, map } = guessMap(rows, ["White"]);
    const r = parseImport(rows, header, map, ["White"]);
    expect(r.players).toHaveLength(32);
    expect(r.players[0].name).toBe("Joe Smith");
    expect(r.players[3].index).toBe(-1.2);
    expect(r.players[7].nh).toBe(true);
  });
});
