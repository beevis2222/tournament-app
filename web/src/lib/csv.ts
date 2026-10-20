import { scrambleRound, scrambleTeamHandicap } from "@starter/scoring";
import { buildFlights, flightLabel } from "./boards";
import { toEngine } from "./toEngine";
import type { EventBundle } from "./types";

/** One CSV cell, quoted per RFC 4180 when it holds a comma, quote or line break. */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  // Stop spreadsheets running text that starts like a formula; real numbers ("-18", "+2") are left alone.
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s) && !/^[+-]?\d+(\.\d+)?$/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

type Row = (string | number | null)[];

/** Everything about the event as CSV text: Field, Teams, Scores, Gross, Net, Prizes. Lines end CRLF. */
export function eventCsv(b: EventBundle): string {
  const ev = toEngine(b);
  const flights = buildFlights(b);
  const teamOf = new Map(b.teams.flatMap((t) => t.entryIds.map((id) => [id, t.label] as const)));
  const teeName = new Map(b.tees.map((t) => [t.id, t.name]));
  const multi = b.event.settings.flights > 1 && flights.length > 0 && flights[0].name !== null;
  const flightName = (team: { flight?: number }) =>
    multi ? flightLabel(b.event.settings.flightNames, team.flight, b.event.settings.flights) : "";
  const playingTeams = ev.teams.filter((t) => t.playerIds.length > 0);
  const rows: Row[] = [];
  const section = (title: string, header: Row, body: Row[]) => {
    if (rows.length) rows.push([]);
    rows.push([title], header, ...body);
  };

  section(
    "Field",
    ["Name", "Handicap index", "Tee", "Team", "Alternate"],
    b.entries.map((e) => [e.name, e.nh ? "NH" : e.indexUsed, e.teeId ? (teeName.get(e.teeId) ?? "") : "", e.alternate ? "" : (teamOf.get(e.id) ?? ""), e.alternate ? "Yes" : ""]),
  );

  section(
    "Teams",
    ["Team", "Flight", "Players", "Team handicap", "Status"],
    playingTeams.map((t) => [t.name, flightName(t), t.playerIds.map((id) => ev.players.find((p) => p.id === id)?.name ?? "").join("; "), scrambleTeamHandicap(ev, t), t.status ?? ""]),
  );

  const scoreRows: Row[] = [];
  playingTeams.forEach((t) =>
    ev.rounds.forEach((_, r) => {
      const card = ev.scores[r]?.[t.id] ?? [];
      if (card.every((g) => g === null || g === undefined)) return;
      scoreRows.push([t.name, r + 1, ...Array.from({ length: 18 }, (_, h) => card[h] ?? ""), scrambleRound(ev, t, r).gross]);
    }),
  );
  section("Scores", ["Team", "Round", ...Array.from({ length: 18 }, (_, i) => i + 1), "Total"], scoreRows);

  for (const kind of ["gross", "net"] as const) {
    const body: Row[] = [];
    for (const f of flights) {
      const board = f.boards.find((x) => x.kind === kind);
      if (!board) continue;
      if (f.name) body.push([f.name]);
      board.rows.forEach((r) => body.push([r.team, r.pos, r.toPar, r.gross, r.net]));
    }
    if (body.length) section(kind === "gross" ? "Gross" : "Net", ["Team", "Position", "To par", "Gross", "Net"], body);
  }

  const prizeRows: Row[] = [];
  for (const f of flights)
    for (const board of f.boards)
      board.rows.filter((r) => r.prize !== null).forEach((r) => prizeRows.push([f.name ?? "", board.kind === "gross" ? "Gross" : "Net", r.team, r.pos, (r.prize as number).toFixed(2)]));
  section("Prizes", ["Flight", "Board", "Team", "Position", "Prize"], prizeRows);

  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** "Shop Scramble!" -> "shop-scramble-results.csv" (the prototype's naming). */
export function csvFilename(eventName: string): string {
  const base = (eventName || "event").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${base || "event"}-results.csv`;
}
