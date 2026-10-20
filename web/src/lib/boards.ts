import { payoutAmounts, scrambleBoards, scrambleLeaderboard, type Team } from "@starter/scoring";
import { toEngine } from "./toEngine";
import type { EventBundle } from "./types";

export type BoardKind = "gross" | "net";

export interface BoardRow {
  teamId: string;
  /** "1", "T2", "WD", or "" when not started. */
  pos: string;
  team: string;
  players: string[];
  /** Display text: "E", "-3", "+2", or "". */
  toPar: string;
  /** Holes scored, blank until the team has started. */
  thru: string;
  gross: number | null;
  net: number | null;
  /** Prize money won on this board, if any. */
  prize: number | null;
}

export interface BoardView {
  kind: BoardKind;
  rows: BoardRow[];
}

export interface FlightView {
  /** null when the whole field is one board. */
  name: string | null;
  /** The catch-all group for teams with no valid flight: ranked, but no prizes. */
  noFlight?: boolean;
  boards: BoardView[];
}

/** Display only: "E" for level, "-3" under par, "+2" over par, "" when not ranked. */
export function toParText(n: number | null): string {
  if (n === null) return "";
  return n === 0 ? "E" : n > 0 ? `+${n}` : String(n);
}

export const NO_FLIGHT = "No flight";

/** Name of a flight number: the event's own name or "A Flight", "B Flight"... */
export function flightLabel(flightNames: string[], flight: number | undefined | null, flights: number): string {
  if (flight === undefined || flight === null || flight < 0 || flight >= flights) return NO_FLIGHT;
  return flightNames[flight]?.trim() || `${String.fromCharCode(65 + flight)} Flight`;
}

/** How many teams sit in the "No flight" group (they can't win prizes). */
export function noFlightCount(flights: FlightView[]): number {
  return flights.find((f) => f.noFlight)?.boards[0]?.rows.length ?? 0;
}

export function noFlightWarning(n: number): string {
  return `${n} ${n === 1 ? "team has" : "teams have"} no flight, so ${n === 1 ? "it can't" : "they can't"} win prizes. Set flights on the Teams page.`;
}

/** Flights (or one whole-field group) with their gross and net boards, prizes included. Standings and money come from the engine. */
export function buildFlights(bundle: EventBundle): FlightView[] {
  const ev = toEngine(bundle);
  const { settings } = bundle.event;
  const names = new Map(bundle.entries.map((e) => [e.id, e.name]));
  // Only teams with at least one playing (non-alternate) player take part.
  const teams = ev.teams.filter((t) => t.playerIds.length > 0);

  const valid = (t: Team) => t.flight !== undefined && t.flight >= 0 && t.flight < settings.flights;
  const split = settings.flights > 1 && teams.some((t) => t.flight !== undefined);
  const groups: { name: string | null; noFlight?: boolean; teams: Team[] }[] = [{ name: null, teams }];
  if (split) {
    groups.length = 0;
    for (let f = 0; f < settings.flights; f++) {
      const ft = teams.filter((t) => valid(t) && t.flight === f);
      if (ft.length) groups.push({ name: flightLabel(settings.flightNames, f, settings.flights), teams: ft });
    }
    const loose = teams.filter((t) => !valid(t));
    if (loose.length) groups.push({ name: NO_FLIGHT, noFlight: true, teams: loose });
  }

  const kinds = scrambleBoards(ev);
  const hasNet = kinds.includes("net");
  return groups.map((g) => ({
    name: g.name,
    ...(g.noFlight ? { noFlight: true } : {}),
    boards: kinds.map((kind) => {
      const lb = scrambleLeaderboard(ev, kind, g.teams);
      const prizes = g.noFlight
        ? new Map<string, number>()
        : payoutAmounts(
            lb.map((r) => ({ id: r.total.team.id, position: r.position, eligible: r.eligible })),
            settings.prizes,
          );
      return {
        kind,
        rows: lb.map((r) => ({
          teamId: r.total.team.id,
          pos: r.label,
          team: r.total.team.name,
          players: r.total.team.playerIds.map((id) => names.get(id) ?? ""),
          toPar: toParText(r.toPar),
          thru: r.total.started ? String(r.total.thru) : "",
          gross: r.total.started ? r.total.gross : null,
          net: r.total.started && hasNet ? r.total.net : null,
          prize: prizes.get(r.total.team.id) ?? null,
        })),
      };
    }),
  }));
}
