import { EventSettings, type EventBundle } from "@/lib/types";
import { csvCell, csvFilename, eventCsv } from "@/lib/csv";

const pars = [4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4];
const si = [7, 1, 15, 9, 3, 11, 17, 5, 13, 8, 2, 16, 10, 4, 12, 18, 6, 14];

function bundle(): EventBundle {
  const entry = (n: number, name: string) => ({ id: `e${n}`, golferId: `g${n}`, name, indexUsed: 10, nh: false, teeId: null, alternate: false });
  return {
    event: { id: "ev1", name: "Shop Scramble", date: "2026-10-24", status: "live", settings: EventSettings.parse({ prizes: [150, 100] }) },
    course: { id: "c1", name: "Home", pars, si },
    tees: [{ id: "t1", name: "White", rating: 70.1, slope: 125, pars: null, si: null }],
    entries: [entry(1, "Ann"), entry(2, "Bob"), entry(3, "Cy"), entry(4, "Di")],
    teams: [
      { id: "tm1", label: "Smith, Jones", flight: null, status: null, sort: 1, entryIds: ["e1", "e2"] },
      { id: "tm2", label: "Team B", flight: null, status: null, sort: 2, entryIds: ["e3", "e4"] },
    ],
    rounds: [{ id: "r1", number: 1, mode: "full" }],
    groups: [],
    scores: pars.flatMap((p, i) => [
      { roundId: "r1", teamId: "tm1", hole: i + 1, gross: p - 1 },
      { roundId: "r1", teamId: "tm2", hole: i + 1, gross: p },
    ]),
  };
}

test("csvCell quotes commas, quotes and line breaks", () => {
  expect(csvCell("a,b")).toBe('"a,b"');
  expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  expect(csvCell("x\ny")).toBe('"x\ny"');
  expect(csvCell(null)).toBe("");
  expect(csvCell(4)).toBe("4");
});

test("event CSV has every section, the board header, and quotes a team name with a comma", () => {
  const csv = eventCsv(bundle());
  const lines = csv.split("\r\n");
  for (const s of ["Field", "Teams", "Scores", "Gross", "Net", "Prizes"]) expect(lines).toContain(s);
  expect(lines).toContain("Team,Position,To par,Gross,Net");
  expect(csv).toContain('"Smith, Jones"');
  expect(lines).toContain('"Smith, Jones",1,-18,54,49');
  expect(lines).toContain("Team B,2,E,72,67");
  expect(lines).toContain(",Net,\"Smith, Jones\",1,150.00");
});

test("file name comes from the event name", () => {
  expect(csvFilename("Shop Scramble!")).toBe("shop-scramble-results.csv");
  expect(csvFilename("???")).toBe("event-results.csv");
});
