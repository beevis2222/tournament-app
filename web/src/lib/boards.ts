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
  boards: BoardView[];
}

/** Display only: "E" for level, "-3" under par, "+2" over par, "" when not ranked. */
export function toParText(n: number | null): string {
  if (n === null) return "";
  return n === 0 ? "E" : n > 0 ? `+${n}` : String(n);
}

/** Flights (or one whole-field group) with their gross and net boards, prizes included. Standings and money come from the engine. */
export function buildFlights(bundle: EventBundle): FlightView[] {
  const ev = toEngine(bundle);
  const { settings } = bundle.event;
  const names = new Map(bundle.entries.map((e) => [e.id, e.name]));
  // Only teams with at least one playing (non-alternate) player take part.
  const teams = ev.teams.filter((t) => t.playerIds.length > 0);

  const split = settings.flights > 1 && teams.some((t) => t.flight !== undefined);
  const groups: { name: string | null; teams: Team[] }[] = split
    ? Array.from({ length: settings.flights }, (_, f) => ({
        name: settings.flightNames[f]?.trim() || `${String.fromCharCode(65 + f)} Flight`,
        teams: teams.filter((t) => (t.flight ?? 0) === f),
      })).filter((g) => g.teams.length > 0)
    : [{ name: null, teams }];

  const kinds = scrambleBoards(ev);
  return groups.map((g) => ({
    name: g.name,
    boards: kinds.map((kind) => {
      const lb = scrambleLeaderboard(ev, kind, g.teams);
      const prizes = payoutAmounts(
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
          net: r.total.started ? r.total.net : null,
          prize: prizes.get(r.total.team.id) ?? null,
        })),
      };
    }),
  }));
}
