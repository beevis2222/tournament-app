// Scramble scoring. Club rules (docs/rules/scramble.md):
// - Team handicap: USGA weights on unrounded course handicaps, low to high
//   (4-person 25/20/15/10, 3-person 20/15/10, 2-person 35/15), then rounded;
//   halved before rounding for a 9-hole round.
// - Gross and net are separate leaderboards; a team can win both.
// - No tiebreak: tied teams share the position and split the prize money.

import { courseHandicap, holesInPlay, jsRound, splitIntoFlights, strokesOnHole } from "./handicap.ts";
import type { Player, ScrambleEvent, Status, Team } from "./types.ts";

export const SCRAMBLE_WEIGHTS: Record<number, number[]> = {
  2: [0.35, 0.15],
  3: [0.2, 0.15, 0.1],
  4: [0.25, 0.2, 0.15, 0.1],
};

function byId(ev: ScrambleEvent): Map<string, Player> {
  return new Map(ev.players.map((p) => [p.id, p]));
}

/** Team handicap for a round (or for an 18-hole round when round is omitted). */
export function scrambleTeamHandicap(ev: ScrambleEvent, team: Team, round?: number): number {
  const players = byId(ev);
  const ps = team.playerIds.map((id) => players.get(id)).filter((p): p is Player => !!p);
  const w = SCRAMBLE_WEIGHTS[ps.length] ?? SCRAMBLE_WEIGHTS[4];
  const ch = ps.map((p) => courseHandicap(ev.course, p, ev.limits, team, players)).sort((a, b) => a - b);
  const v = ch.reduce((sum, c, i) => sum + c * (i < w.length ? w[i] : 0), 0);
  const nine = round !== undefined && holesInPlay(ev.holes, ev.rounds[round]).length === 9;
  return jsRound(nine ? v / 2 : v);
}

export interface RoundResult {
  round: number;
  /** Holes that count this round (0 if called off). */
  holes: number;
  /** Holes with a score entered. */
  thru: number;
  complete: boolean;
  handicap: number;
  gross: number;
  net: number;
  grossToPar: number;
  netToPar: number;
}

export function scrambleRound(ev: ScrambleEvent, team: Team, round: number): RoundResult {
  const holes = holesInPlay(ev.holes, ev.rounds[round]);
  const hcp = scrambleTeamHandicap(ev, team, round);
  const card = ev.scores[round]?.[team.id] ?? [];
  let thru = 0, gross = 0, net = 0, grossToPar = 0, netToPar = 0;
  for (const h of holes) {
    const g = card[h];
    if (g === null || g === undefined) continue;
    const n = g - strokesOnHole(hcp, h, holes, ev.course.si);
    thru++;
    gross += g;
    net += n;
    grossToPar += g - ev.course.pars[h];
    netToPar += n - ev.course.pars[h];
  }
  return { round, holes: holes.length, thru, complete: holes.length > 0 && thru === holes.length, handicap: hcp, gross, net, grossToPar, netToPar };
}

export interface TeamTotal {
  team: Team;
  rounds: RoundResult[];
  started: boolean;
  /** Every counted hole in every round has a score. */
  complete: boolean;
  thru: number;
  gross: number;
  net: number;
  grossToPar: number;
  netToPar: number;
}

export function scrambleTotal(ev: ScrambleEvent, team: Team): TeamTotal {
  const rounds = ev.rounds.map((_, r) => scrambleRound(ev, team, r));
  const sum = (k: "thru" | "gross" | "net" | "grossToPar" | "netToPar") => rounds.reduce((a, r) => a + r[k], 0);
  const counted = rounds.filter((r) => r.holes > 0);
  return {
    team,
    rounds,
    started: sum("thru") > 0,
    complete: counted.length > 0 && counted.every((r) => r.complete),
    thru: sum("thru"),
    gross: sum("gross"),
    net: sum("net"),
    grossToPar: sum("grossToPar"),
    netToPar: sum("netToPar"),
  };
}

export interface LeaderboardRow {
  total: TeamTotal;
  /** 1 = first. null for teams that haven't started or have a status. */
  position: number | null;
  /** "1", "T2", "WD", or "" when not started. */
  label: string;
  /** To par on this board (gross or net); null when not ranked. */
  toPar: number | null;
  /** Can place and win prize money. */
  eligible: boolean;
  status?: Status;
}

/**
 * Gross or net leaderboard for the given teams (a flight, or the whole
 * field). Lowest to par first. Ties share the position (no countback).
 * Teams with WD/DQ/NS drop to the bottom, unstarted teams just above them.
 */
export function scrambleLeaderboard(ev: ScrambleEvent, kind: "gross" | "net", teams: Team[] = ev.teams): LeaderboardRow[] {
  const totals = teams.map((t) => scrambleTotal(ev, t));
  const toPar = (t: TeamTotal) => (kind === "gross" ? t.grossToPar : t.netToPar);
  const ranked = totals.filter((t) => !t.team.status && t.started).sort((a, b) => toPar(a) - toPar(b));
  const unstarted = totals.filter((t) => !t.team.status && !t.started);
  const withStatus = totals.filter((t) => !!t.team.status);

  const rows: LeaderboardRow[] = [];
  for (const t of ranked) {
    const position = ranked.findIndex((x) => toPar(x) === toPar(t)) + 1;
    const tied = ranked.filter((x) => toPar(x) === toPar(t)).length > 1;
    rows.push({ total: t, position, label: (tied ? "T" : "") + position, toPar: toPar(t), eligible: true });
  }
  unstarted.forEach((t) => rows.push({ total: t, position: null, label: "", toPar: null, eligible: true }));
  withStatus.forEach((t) => rows.push({ total: t, position: null, label: t.team.status!, toPar: null, eligible: false, status: t.team.status }));
  return rows;
}

/**
 * Balanced teams by handicap ("Pro makes balanced teams"): players sorted by
 * index, then snake-drafted (1-2-3-3-2-1...). Leftover players are alternates.
 * Matches the prototype's draw exactly.
 */
export function drawBalancedTeams(players: Player[], size = 4): { teams: string[][]; alternates: string[] } {
  const sorted = [...players].sort((a, b) => a.index - b.index);
  const n = Math.floor(sorted.length / size);
  if (n < 1) return { teams: [], alternates: sorted.map((p) => p.id) };
  const teams: string[][] = Array.from({ length: n }, () => []);
  sorted.slice(0, n * size).forEach((p, i) => {
    const row = Math.floor(i / n), pos = i % n;
    teams[row % 2 === 0 ? pos : n - 1 - pos].push(p.id);
  });
  return { teams, alternates: sorted.slice(n * size).map((p) => p.id) };
}

/**
 * Teams as signed up ("Players sign up as teams"): players taken in listed
 * order, `size` at a time. Leftover players are alternates.
 */
export function listedTeams(players: Player[], size = 4): { teams: string[][]; alternates: string[] } {
  const n = Math.floor(players.length / size);
  return {
    teams: Array.from({ length: n }, (_, i) => players.slice(i * size, i * size + size).map((p) => p.id)),
    alternates: players.slice(n * size).map((p) => p.id),
  };
}

/** Flights by 18-hole team handicap, lowest in the top flight. Returns team ids per flight. */
export function scrambleFlights(ev: ScrambleEvent, flights: number): string[][] {
  const sorted = [...ev.teams].sort((a, b) => scrambleTeamHandicap(ev, a) - scrambleTeamHandicap(ev, b));
  return splitIntoFlights(sorted, flights).map((f) => f.map((t) => t.id));
}
