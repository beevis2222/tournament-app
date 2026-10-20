import {
  drawBalancedTeams,
  effectiveIndex,
  listedTeams,
  scrambleFlights,
  scrambleTeamHandicap,
  type HandicapLimits,
  type Player,
  type Team,
} from "@starter/scoring";
import { toEngine } from "./toEngine";
import type { EventBundle } from "./types";

export type TeamDraft = { label: string; entryIds: string[] };
export type SheetGroup = { label: string; entryIds: string[] };

const asPlayers = (b: EventBundle): Player[] =>
  b.entries.map((e) => ({ id: e.id, name: e.name, index: e.indexUsed, ...(e.nh ? { nh: true } : {}) }));

/**
 * New teams for the whole field (every entry that isn't removed). "balanced" snake-drafts by
 * index; "listed" takes players in the order they were added, or follows the spreadsheet's
 * groups when given. Leftover players are alternates.
 */
export function planTeams(
  b: EventBundle,
  mode: "listed" | "balanced",
  groups?: SheetGroup[],
): { teams: TeamDraft[]; alternates: string[] } {
  const size = b.event.settings.teamSize;
  if (groups) {
    const placed = new Set(groups.flatMap((g) => g.entryIds));
    return {
      teams: groups.map((g) => ({ label: g.label, entryIds: g.entryIds })),
      alternates: b.entries.filter((e) => !placed.has(e.id)).map((e) => e.id),
    };
  }
  const drawn = mode === "balanced" ? drawBalancedTeams(asPlayers(b), size) : listedTeams(asPlayers(b), size);
  return {
    teams: drawn.teams.map((ids, i) => ({ label: `Team ${i + 1}`, entryIds: ids })),
    alternates: drawn.alternates,
  };
}

/** Team handicap per team id, from the engine. Needs a course (call hasCourse first). */
export function teamHandicaps(b: EventBundle): Map<string, number> {
  const ev = toEngine(b);
  return new Map(ev.teams.map((t) => [t.id, scrambleTeamHandicap(ev, t)]));
}

/** Flight number (0 = top) per team id, from the engine. Needs a course. */
export function flightAssignments(b: EventBundle): Map<string, number> {
  const out = new Map<string, number>();
  scrambleFlights(toEngine(b), b.event.settings.flights).forEach((ids, i) => ids.forEach((id) => out.set(id, i)));
  return out;
}

/** Shown before new teams replace teams that already have scores. */
export const SCORES_WARNING = "Cards have been entered for these teams. Making new teams will hide those cards. Continue?";

export function flightName(names: string[], i: number): string {
  return names[i]?.trim() || `${String.fromCharCode(65 + i)} Flight`;
}

/**
 * Handicap limit warnings per entry id, from the engine's effectiveIndex: a player whose
 * index the limits would lower gets a message. The gap is checked the same way whether the
 * event only flags it or reduces it.
 */
export function limitWarnings(b: EventBundle): Map<string, string[]> {
  const limits: HandicapLimits = b.event.settings.limits;
  const out = new Map<string, string[]>();
  if ((limits.cap ?? null) === null && (limits.gap ?? null) === null) return out;
  const players = new Map<string, Player>(asPlayers(b).map((p) => [p.id, p]));
  const add = (id: string, msg: string) => out.set(id, [...(out.get(id) ?? []), msg]);

  for (const p of players.values()) {
    const capped = effectiveIndex(p, { cap: limits.cap }, undefined, players);
    if (capped !== p.index) add(p.id, `Over the ${limits.cap} cap: plays off ${capped}`);
  }
  if ((limits.gap ?? null) !== null) {
    const alt = new Set(b.entries.filter((e) => e.alternate).map((e) => e.id));
    for (const t of b.teams) {
      const team: Team = { id: t.id, name: t.label, playerIds: t.entryIds.filter((id) => !alt.has(id)) };
      for (const id of team.playerIds) {
        const p = players.get(id)!;
        const reduced = effectiveIndex(p, { cap: limits.cap, gap: limits.gap, gapMode: "reduce" }, team, players);
        const capOnly = effectiveIndex(p, { cap: limits.cap }, undefined, players);
        if (reduced !== capOnly) {
          const how = limits.gapMode === "reduce" ? "plays off" : "would play off";
          add(id, `More than ${limits.gap} strokes above a teammate: ${how} ${reduced}`);
        }
      }
    }
  }
  return out;
}
