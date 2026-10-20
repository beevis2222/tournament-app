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
      teams.push({ id: t.id, label: t.label, hcp, players });
    }
    if (teams.length > 0) out.push({ id: g.id, start: startText(g), label: g.label, teams });
  }
  return out;
}

/** "Alan Reeves" -> "Reeves, Alan". One word stays as it is. */
export function lastFirst(name: string): string {
  const w = name.trim().split(/\s+/);
  return w.length > 1 ? `${w[w.length - 1]}, ${w.slice(0, -1).join(" ")}` : name.trim();
}

export interface AlphaRow {
  name: string;
  hcp: string;
  start: string;
}

/** Every player once, sorted by last name then first name. */
export function alphaRows(groups: PrintGroup[]): AlphaRow[] {
  const rows = groups.flatMap((g) =>
    g.teams.flatMap((t) => t.players.map((p) => ({ name: lastFirst(p.name), hcp: p.hcp, start: g.start }))),
  );
  return rows.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
}

export interface StarterRow {
  name: string;
  team: string;
  tee: string;
  hcp: string;
  /** Carts hold two players, numbered from 1 down the sheet. */
  cart: number;
}
export interface StarterGroup {
  start: string;
  label: string;
  rows: StarterRow[];
}

export function starterSheet(groups: PrintGroup[]): { groups: StarterGroup[]; players: number; carts: number } {
  let cart = 0;
  let seat = 0;
  let players = 0;
  const out = groups.map((g) => {
    seat = 0; // a cart never carries players from two groups
    const rows = g.teams.flatMap((t) =>
      t.players.map((p) => {
        if (seat % 2 === 0) cart++;
        seat++;
        players++;
        return { name: p.name, team: t.label, tee: p.tee, hcp: p.hcp, cart };
      }),
    );
    return { start: g.start, label: g.label, rows };
  });
  return { groups: out, players, carts: cart };
}

/** Strokes the team gets on each hole (0-17) for the round: dots on the printed card. */
export function strokesForTeam(ev: ScrambleEvent, teamId: string, roundIdx: number): { hcp: number; strokes: number[] } | null {
  const team = ev.teams.find((t) => t.id === teamId);
  if (!team) return null;
  const hcp = scrambleRound(ev, team, roundIdx).handicap;
  const holes = holesInPlay(ev.holes, ev.rounds[roundIdx]);
  return { hcp, strokes: Array.from({ length: 18 }, (_, h) => strokesOnHole(hcp, h, holes, ev.course.si)) };
}
