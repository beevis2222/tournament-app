import { EventSettings, type EventBundle } from "@/lib/types";
import { buildFlights, noFlightCount, noFlightWarning, toParText } from "@/lib/boards";

const pars = [4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4];
const si = [7, 1, 15, 9, 3, 11, 17, 5, 13, 8, 2, 16, 10, 4, 12, 18, 6, 14];

function bundle(flights = 1): EventBundle {
  const entry = (n: number) => ({ id: `e${n}`, golferId: `g${n}`, name: `P${n}`, indexUsed: 10, nh: false, teeId: null, alternate: n === 9 });
  const team = (n: number, flight: number | null) => ({ id: `tm${n}`, label: `T${n}`, flight, status: null, sort: n, entryIds: [`e${n}`] });
  const gross = (t: number) => (t === 3 ? 5 : 4); // T1 and T2 tie, T3 is worse
  return {
    event: { id: "ev", name: "X", date: "2026-10-24", status: "live", settings: EventSettings.parse({ flights, flightNames: flights > 1 ? ["Low"] : [] }) },
    course: { id: "c", name: "Home", pars: pars.map(() => 4), si },
    tees: [{ id: "t1", name: "White", rating: 70, slope: 113, pars: null, si: null }],
    entries: [1, 2, 3, 9].map(entry),
    teams: [team(1, 0), team(2, flights > 1 ? 1 : 0), team(3, 0), { id: "tm9", label: "Empty", flight: 0, status: null, sort: 9, entryIds: ["e9"] }],
    rounds: [{ id: "r1", number: 1, mode: "full" }],
    groups: [],
    scores: [1, 2, 3].flatMap((t) => pars.map((_, i) => ({ roundId: "r1", teamId: `tm${t}`, hole: i + 1, gross: gross(t) }))),
  };
}

test("to par text", () => {
  expect([0, -3, 2, null].map(toParText)).toEqual(["E", "-3", "+2", ""]);
});

test("tied teams split the prizes and a team with only alternates is left off", () => {
  const [flight] = buildFlights(bundle());
  expect(flight.name).toBeNull();
  const net = flight.boards.find((b) => b.kind === "net")!;
  expect(net.rows.map((r) => r.team)).toEqual(["T1", "T2", "T3"]);
  expect(net.rows.map((r) => r.pos)).toEqual(["T1", "T1", "3"]);
  expect(net.rows.map((r) => r.prize)).toEqual([125, 125, 50]);
});

test("flights get names and their own boards", () => {
  const flights = buildFlights(bundle(2));
  expect(flights.map((f) => f.name)).toEqual(["Low", "B Flight"]);
  expect(flights[1].boards[0].rows.map((r) => r.team)).toEqual(["T2"]);
});

const team = (b: EventBundle, id: string) => b.teams.find((t) => t.id === id)!;
const netPrizes = (b: EventBundle) => buildFlights(b).flatMap((f) => f.boards.find((x) => x.kind === "net")!.rows.map((r) => [f.name, r.team, r.prize]));

test("teams with no flight or an out-of-range flight go in a last group with no prizes", () => {
  const b = bundle(2);
  team(b, "tm3").flight = null;
  team(b, "tm1").flight = 5;
  const flights = buildFlights(b);
  expect(flights.map((f) => f.name)).toEqual(["B Flight", "No flight"]);
  expect(flights[1].noFlight).toBe(true);
  expect(flights[1].boards[0].rows.map((r) => r.team).sort()).toEqual(["T1", "T3"]);
  expect(flights[1].boards.flatMap((x) => x.rows.map((r) => r.prize))).toEqual([null, null, null, null]);
  expect(flights[0].boards[0].rows[0].prize).toBe(150);
  expect(noFlightCount(flights)).toBe(2);
  expect(noFlightWarning(2)).toBe("2 teams have no flight, so they can't win prizes. Set flights on the Teams page.");
});

test("a withdrawn team wins nothing", () => {
  const b = bundle();
  team(b, "tm3").status = "WD";
  expect(netPrizes(b).find((r) => r[1] === "T3")![2]).toBeNull();
});

test("a three-way tie for first splits 150/100/50 into $100 each", () => {
  const b = bundle();
  b.scores.filter((s) => s.teamId === "tm3").forEach((s) => (s.gross = 4));
  expect(netPrizes(b).map((r) => r[2])).toEqual([100, 100, 100]);
});

test("with handicaps off there is no net board and the Net column is blank", () => {
  const b = bundle();
  b.event.settings = EventSettings.parse({ teamHandicap: { method: "none" } });
  const [flight] = buildFlights(b);
  expect(flight.boards.map((x) => x.kind)).toEqual(["gross"]);
  expect(flight.boards[0].rows.every((r) => r.net === null)).toBe(true);
});
