import {
  courseHandicap,
  holesInPlay,
  jsRound,
  scrambleHasNet,
  scrambleRound,
  strokesOnHole,
  teeFor,
  type ScrambleEvent,
} from "@starter/scoring";
import { fmtTime } from "./pairings";
import { hasCourse, toEngine } from "./toEngine";
import type { EventBundle } from "./types";

export interface PrintPlayer {
  name: string;
  /** "12", "NH" (no handicap index) or "" when there is no course yet. */
  hcp: string;
  /** Tee name, or "" when there is no course yet. */
  tee: string;
}
export interface PrintTeam {
  id: string;
  status: "WD" | "DQ" | "NS" | null;
  label: string;
  /** Team handicap for the round; null when handicaps are off or there is no course. */
  hcp: number | null;
  players: PrintPlayer[];
}
export interface PrintGroup {
  id: string;
  /** "8:00 am" or a hole such as "3" or "12B". */
  start: string;
  label: string;
  teams: PrintTeam[];
}

/** Sort key for a start: tee times by time, holes by number then A/B. */
export function startOrder(g: { startHole: string | null; startTime: string | null }): [number, string] {
  if (g.startTime) return [Number(g.startTime.replace(":", "")), ""];
  const m = /^(\d+)(.*)$/.exec(g.startHole ?? "");
  return m ? [Number(m[1]), m[2]] : [Infinity, ""];
}

export function startText(g: { startHole: string | null; startTime: string | null }): string {
  return g.startHole ?? (g.startTime ? fmtTime(g.startTime) : "No start");
}

/** The round a ?round=N link points at (rounds are numbered from 1); the first round when missing or bad. */
export function pickRound(b: EventBundle, param?: string | null): EventBundle["rounds"][number] | null {
  const rounds = [...b.rounds].sort((a, c) => a.number - c.number);
  const n = Number(param);
  return rounds.find((r) => r.number === n) ?? rounds[0] ?? null;
}

/** "Round 2" when the event has several rounds, otherwise "". */
export function roundText(b: EventBundle, roundNumber: number): string {
  return b.rounds.length > 1 ? `Round ${roundNumber}` : "";
}

/**
 * The round's groups in start order for printing. Empty groups are skipped,
 * and so are alternates and teams with nobody playing.
 */
export function printGroups(b: EventBundle, roundId: string): PrintGroup[] {
  const entryById = new Map(b.entries.map((e) => [e.id, e]));
  const teamById = new Map(b.teams.map((t) => [t.id, t]));
  const course = hasCourse(b);
  const ev: ScrambleEvent | null = course ? toEngine(b) : null;
  const playersById = ev ? new Map(ev.players.map((p) => [p.id, p])) : null;
  const roundIdx = [...b.rounds].sort((a, c) => a.number - c.number).findIndex((r) => r.id === roundId);

  const groups = b.groups
    .filter((g) => g.roundId === roundId && g.teamIds.length > 0)
    .sort((a, c) => {
      const [x, xs] = startOrder(a);
      const [y, ys] = startOrder(c);
      return x - y || xs.localeCompare(ys) || a.sort - c.sort;
    });

  const out: PrintGroup[] = [];
  for (const g of groups) {
    const teams: PrintTeam[] = [];
    for (const tid of g.teamIds) {
      const t = teamById.get(tid);
      if (!t) continue;
      const entries = t.entryIds.map((id) => entryById.get(id)).filter((e) => e && !e.alternate);
      if (entries.length === 0) continue;
      const engTeam = ev?.teams.find((x) => x.id === tid);
      const players = entries.map((e) => {
        const p = playersById?.get(e!.id);
        if (!ev || !p) return { name: e!.name, hcp: "", tee: "" };
        return {
          name: e!.name,
          hcp: !scrambleHasNet(ev) ? "" : p.nh ? "NH" : String(jsRound(courseHandicap(ev.course, p, ev.limits, engTeam, playersById!))),
          tee: teeFor(ev.course, p).name,
        };
      });
      const hcp = ev && engTeam && roundIdx >= 0 && scrambleHasNet(ev) ? scrambleRound(ev, engTeam, roundIdx).handicap : null;
      teams.push({ id: t.id, status: t.status, label: t.label, hcp, players });
    }
    if (teams.length > 0) out.push({ id: g.id, start: startText(g), label: g.label, teams });
  }
  return out;
}

/**
 * Teams that play (someone on them is not an alternate) but are in none of the round's groups,
 * so they are not on the printed sheets.
 */
export function teamsWithoutStart(b: EventBundle, roundId: string): number {
  const entryById = new Map(b.entries.map((e) => [e.id, e]));
  const placed = new Set(b.groups.filter((g) => g.roundId === roundId).flatMap((g) => g.teamIds));
  const playing = b.teams.filter((t) => t.entryIds.some((id) => entryById.has(id) && !entryById.get(id)!.alternate));
  return playing.filter((t) => !placed.has(t.id)).length;
}

export function noStartText(n: number): string {
  return `${n} ${n === 1 ? "team has" : "teams have"} no start and ${n === 1 ? "isn't" : "aren't"} on these sheets.`;
}

/** "Alan Reeves" -> "Reeves, Alan". One word stays as it is. */
export function lastFirst(name: string): string {
  const w = name.trim().split(/\s+/);
  return w.length > 1 ? `${w[w.length - 1]}, ${w.slice(0, -1).join(" ")}` : name.trim();
}

/** Handicap text for a sheet: nothing for no-handicap players, like the prototype. */
export const hcpText = (hcp: string): string => (hcp === "NH" ? "" : hcp);

export interface AlphaRow {
  name: string;
  hcp: string;
  start: string;
}

/** "Alan Reeves" -> "reeves alan": the prototype sorts on last name, then first. */
function sortKey(name: string): string {
  const w = name.trim().split(/\s+/);
  return (w[w.length - 1] + " " + w.slice(0, -1).join(" ")).toLowerCase();
}

/** Every player once, sorted by last name then first name. */
export function alphaRows(groups: PrintGroup[]): AlphaRow[] {
  const rows = groups.flatMap((g) =>
    g.teams.flatMap((t) => t.players.map((p) => ({ key: sortKey(p.name), name: lastFirst(p.name), hcp: hcpText(p.hcp), start: g.start }))),
  );
  return rows.sort((a, b) => a.key.localeCompare(b.key)).map((r) => ({ name: r.name, hcp: r.hcp, start: r.start }));
}

export interface CartSet {
  /** Numbered from 1 across the whole sheet. */
  cart: number;
  groupId: string;
  start: string;
  groupLabel: string;
  /** Team names on this cart, in order, once each. */
  teams: string[];
  /** hcp is the raw value ("NH" for no handicap): the starter sheet shows it, cart signs use hcpText. */
  players: { name: string; team: string; hcp: string; tee: string; status: PrintTeam["status"] }[];
}

/** Carts hold two players. A cart never carries players from two groups; an odd group ends with a one-player cart. */
export function cartSets(groups: PrintGroup[]): CartSet[] {
  const out: CartSet[] = [];
  for (const g of groups) {
    const players = g.teams.flatMap((t) => t.players.map((p) => ({ name: p.name, team: t.label, hcp: p.hcp, tee: p.tee, status: t.status })));
    for (let i = 0; i < players.length; i += 2) {
      const set = players.slice(i, i + 2);
      out.push({ cart: out.length + 1, groupId: g.id, start: g.start, groupLabel: g.label, teams: [...new Set(set.map((p) => p.team))], players: set });
    }
  }
  return out;
}

export interface StarterRow {
  name: string;
  team: string;
  tee: string;
  hcp: string;
  status: PrintTeam["status"];
  cart: number;
}
export interface StarterGroup {
  start: string;
  label: string;
  rows: StarterRow[];
}

export function starterSheet(groups: PrintGroup[]): { groups: StarterGroup[]; players: number; carts: number } {
  const sets = cartSets(groups);
  const out: (StarterGroup & { id: string })[] = [];
  for (const c of sets) {
    let g = out[out.length - 1];
    if (!g || g.id !== c.groupId) out.push((g = { id: c.groupId, start: c.start, label: c.groupLabel, rows: [] }));
    for (const p of c.players) g.rows.push({ name: p.name, team: p.team, tee: p.tee, hcp: p.hcp, status: p.status, cart: c.cart });
  }
  return { groups: out, players: sets.reduce((n, c) => n + c.players.length, 0), carts: sets.length };
}

/** Strokes the team gets on each hole (0-17) for the round: dots on the printed card. */
export function strokesForTeam(ev: ScrambleEvent, teamId: string, roundIdx: number): { hcp: number; strokes: number[] } | null {
  const team = ev.teams.find((t) => t.id === teamId);
  if (!team) return null;
  const hcp = scrambleRound(ev, team, roundIdx).handicap;
  const holes = holesInPlay(ev.holes, ev.rounds[roundIdx]);
  return { hcp, strokes: Array.from({ length: 18 }, (_, h) => strokesOnHole(hcp, h, holes, ev.course.si)) };
}
