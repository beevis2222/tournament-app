// Handicap math shared by every format. Mirrors references/scoring-math.md
// sections 1-5 and reference/golf_math.py exactly.

import type { Course, HandicapLimits, HolesSetting, Player, RoundMode, Team, Tee } from "./types.ts";

/** Round half up (7.5 -> 8, -0.5 -> 0), like JavaScript Math.round. Never use banker's rounding. */
export function jsRound(x: number): number {
  return Math.floor(x + 0.5);
}

export function teeFor(course: Course, player: Player | null | undefined): Tee {
  return course.tees.find((t) => t.id === player?.teeId) ?? course.tees[0];
}

export function teePars(course: Course, player: Player | null | undefined): number[] {
  const t = player ? teeFor(course, player) : null;
  return t?.pars && t.pars.length === 18 ? t.pars : course.pars;
}

export function teeStrokeIndex(course: Course, player: Player | null | undefined): number[] {
  const t = player ? teeFor(course, player) : null;
  return t?.si && t.si.length === 18 ? t.si : course.si;
}

/**
 * Index actually used after handicap limits: the cap, then (if set to
 * "reduce") the max gap between teammates.
 */
export function effectiveIndex(
  player: Player,
  limits: HandicapLimits | undefined,
  team?: Team,
  playersById?: Map<string, Player>,
): number {
  const cap = limits?.cap ?? null;
  const gap = limits?.gap ?? null;
  let i = player.index;
  if (cap !== null && i > cap) i = cap;
  if (gap !== null && limits?.gapMode === "reduce" && team && playersById && team.playerIds.length > 1) {
    const ids = team.playerIds.filter((id) => playersById.has(id) && !playersById.get(id)!.nh);
    if (ids.length >= 2) {
      const capped = (id: string) => {
        const ix = playersById.get(id)!.index;
        return cap !== null ? Math.min(ix, cap) : ix;
      };
      const lo = Math.min(...ids.map(capped));
      if (i > lo + gap) i = jsRound((lo + gap) * 10) / 10;
    }
  }
  return i;
}

/** Course handicap, unrounded: Index x (Slope / 113) + (Rating - Par of the player's tee). */
export function courseHandicap(
  course: Course,
  player: Player,
  limits?: HandicapLimits,
  team?: Team,
  playersById?: Map<string, Player>,
): number {
  if (player.nh) return 0;
  const t = teeFor(course, player);
  const par = teePars(course, player).reduce((a, b) => a + b, 0);
  return effectiveIndex(player, limits, team, playersById) * (t.slope / 113) + (t.rating - par);
}

/** Hole numbers (0-17) that count in a round. A called-off round counts no holes. */
export function holesInPlay(setting: HolesSetting, mode: RoundMode = "full"): number[] {
  if (mode === "called_off") return [];
  const m = mode === "front" || mode === "back" ? mode : setting;
  const all = Array.from({ length: 18 }, (_, i) => i);
  if (m === "front") return all.slice(0, 9);
  if (m === "back") return all.slice(9);
  return all;
}

/** Strokes given back, as a negative number (never -0). */
const give = (k: number) => (k === 0 ? 0 : -k);

/**
 * Strokes received on one hole for playing handicap h. Negative = strokes
 * given back (plus handicaps, on the easiest holes). For a 9-hole round the
 * nine holes are ranked by stroke index and strokes go to the hardest first.
 */
export function strokesOnHole(h: number, hole: number, holes: number[], si: number[]): number {
  if (holes.length === 18 || holes.length === 0) {
    const x = si[hole];
    if (h >= 0) return Math.floor(h / 18) + (x <= h % 18 ? 1 : 0);
    const p = -h;
    return give(Math.floor(p / 18) + (x > 18 - (p % 18) ? 1 : 0));
  }
  const ranked = [...holes].sort((a, b) => si[a] - si[b]);
  const pos = ranked.indexOf(hole);
  if (pos < 0) return 0;
  const n = holes.length;
  if (h >= 0) return Math.floor(h / n) + (pos < h % n ? 1 : 0);
  const p = -h;
  return give(Math.floor(p / n) + (pos >= n - (p % n) ? 1 : 0));
}

/**
 * Split items (already sorted best/lowest first) into n flights as evenly as
 * possible. Extra items go to the higher flights first.
 */
export function splitIntoFlights<T>(sorted: T[], n: number): T[][] {
  const k = Math.max(1, Math.min(n, sorted.length || 1));
  const base = Math.floor(sorted.length / k);
  const extra = sorted.length % k;
  const out: T[][] = [];
  let at = 0;
  for (let i = 0; i < k; i++) {
    const size = base + (i < extra ? 1 : 0);
    out.push(sorted.slice(at, at + size));
    at += size;
  }
  return out;
}
