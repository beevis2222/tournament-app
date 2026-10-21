import { buildFlights, unsplitFlights, unsplitWarning } from "@/lib/boards";
import { eventCsv } from "@/lib/csv";
import { preEventCheck } from "@/lib/pairings";
import { alphaRows, cartSets, hcpText, noStartText, printGroups, starterSheet, teamsWithoutStart } from "@/lib/printData";
import { EventSettings, type EventBundle } from "@/lib/types";

const si = [7, 1, 15, 9, 3, 11, 17, 5, 13, 8, 2, 16, 10, 4, 12, 18, 6, 14];

function bundle(settings: object = {}): EventBundle {
  const entry = (n: number, alternate = false, nh = false) => ({
    id: `e${n}`, golferId: `g${n}`, name: `Player ${n}`, indexUsed: 10, nh, teeId: null, alternate,
  });
  const team = (n: number, ids: string[], flight: number | null = null) => ({ id: `t${n}`, label: `Team ${n}`, flight, status: null, sort: n, entryIds: ids });
  return {
    event: { id: "ev", name: "Scramble", date: "2026-10-24", status: "live", settings: EventSettings.parse({ teamSize: 2, ...settings }) },
    course: { id: "c", name: "Home", pars: si.map(() => 4), si },
    tees: [{ id: "tee", name: "White", rating: 70, slope: 113, pars: null, si: null }],
    entries: [entry(1, false, true), entry(2), entry(3), entry(4), entry(5, true), entry(6, true)],
    teams: [team(1, ["e1", "e2"]), team(2, ["e3", "e4"]), team(3, ["e5", "e6"])], // team 3: only alternates
    rounds: [{ id: "r1", number: 1, mode: "full" }],
    groups: [{ id: "g1", roundId: "r1", startHole: "1", startTime: null, label: "", sort: 1, teamIds: ["t1"] }],
    scores: [],
  };
}

describe("starter sheet keeps NH (D1)", () => {
  it("shows NH on the starter sheet, blank on cart signs and the alpha list", () => {
    const groups = printGroups(bundle(), "r1");
    const row = starterSheet(groups).groups[0].rows.find((r) => r.name === "Player 1")!;
    expect(row.hcp).toBe("NH");
    const cartPlayer = cartSets(groups)[0].players.find((p) => p.name === "Player 1")!;
    expect(hcpText(cartPlayer.hcp)).toBe("");
    expect(alphaRows(groups).find((r) => r.name === "Player, 1" || r.name.includes("1"))!.hcp).toBe("");
  });
});

describe("teams with no start (I4)", () => {
  it("counts playing teams that are in no group, not teams of only alternates", () => {
    expect(teamsWithoutStart(bundle(), "r1")).toBe(1); // team 2; team 3 has nobody playing
    expect(noStartText(1)).toBe("1 team has no start and isn't on these sheets.");
    expect(noStartText(3)).toBe("3 teams have no start and aren't on these sheets.");
  });
});

describe("flights asked for but not split (I5)", () => {
  it("warns when several flights are set and no team has one", () => {
    expect(unsplitFlights(bundle({ flights: 3 }))).toBe(3);
    expect(unsplitWarning(3)).toBe("This event has 3 flights but teams haven't been split. Split them on the Teams page.");
  });
  it("does not warn for one flight or once any team is flighted, and still pays whole-field prizes", () => {
    expect(unsplitFlights(bundle({ flights: 1 }))).toBe(0);
    const b = bundle({ flights: 3 });
    expect(buildFlights(b)).toHaveLength(1);
    b.teams[0].flight = 0;
    expect(unsplitFlights(b)).toBe(0);
  });
});

describe("a team with nobody playing is not there (M8, M9)", () => {
  it("is left out of the pre-event check", () => {
    const texts = preEventCheck(bundle()).map((p) => p.text);
    expect(texts.some((t) => t.includes("Team 3"))).toBe(false);
    expect(texts).toContain("Team 2 has no starting hole or time.");
  });
  it("is left out of the CSV, and alternates show no team", () => {
    const csv = eventCsv(bundle()).split("\r\n");
    expect(csv.some((l) => l.startsWith("Team 3,"))).toBe(false);
    const alt = csv.find((l) => l.startsWith("Player 5,"))!;
    expect(alt).toBe("Player 5,10,,,Yes");
  });
});
