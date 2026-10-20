import type { TablesInsert } from "@/lib/database.types";
import { EventSettings, type EventBundle } from "./types";

export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
export const RESTORED = " (restored)";

export interface ImportPlan {
  eventName: string;
  course: TablesInsert<"courses">;
  tees: TablesInsert<"tees">[];
  /** Only golfers that don't already exist in the club. */
  newGolfers: TablesInsert<"golfers">[];
  event: TablesInsert<"events">;
  entries: TablesInsert<"entries">[];
  teams: TablesInsert<"teams">[];
  teamMembers: TablesInsert<"team_members">[];
  rounds: TablesInsert<"rounds">[];
  groups: TablesInsert<"groups">[];
  groupTeams: TablesInsert<"group_teams">[];
  scores: TablesInsert<"scores">[];
}

const key = (s: string) => s.trim().toLowerCase();

/**
 * Turns one backup event into the rows to insert, keeping the bundle's ids so every reference lines up.
 * The event gets " (restored)" when `existingEventNames` already has that name; golfers match
 * `existingGolfers` (name -> id) by case-insensitive name, otherwise a new golfer is made.
 */
export function bundleToRows(
  bundle: EventBundle,
  clubId: string,
  existingEventNames: Iterable<string>,
  existingGolfers: { id: string; name: string }[],
): ImportPlan {
  const taken = new Set([...existingEventNames].map(key));
  const eventName = taken.has(key(bundle.event.name)) ? bundle.event.name + RESTORED : bundle.event.name;

  const golferByName = new Map<string, string>();
  for (const g of existingGolfers) if (!golferByName.has(key(g.name))) golferByName.set(key(g.name), g.id);
  const newGolfers: TablesInsert<"golfers">[] = [];
  const golferFor = (entry: EventBundle["entries"][number]): string => {
    const known = golferByName.get(key(entry.name));
    if (known) return known;
    golferByName.set(key(entry.name), entry.golferId);
    newGolfers.push({ id: entry.golferId, club_id: clubId, name: entry.name, index: entry.indexUsed, nh: entry.nh });
    return entry.golferId;
  };

  const courseId = bundle.course.id;
  const entries = bundle.entries.map((e) => ({
    id: e.id,
    event_id: bundle.event.id,
    golfer_id: golferFor(e),
    index_used: e.indexUsed,
    nh: e.nh,
    tee_id: e.teeId,
    alternate: e.alternate,
  }));

  return {
    eventName,
    course: { id: courseId, club_id: clubId, name: bundle.course.name, pars: bundle.course.pars, si: bundle.course.si },
    tees: bundle.tees.map((t) => ({
      id: t.id,
      course_id: courseId,
      name: t.name,
      rating: t.rating,
      slope: t.slope,
      pars: t.pars,
      si: t.si,
    })),
    newGolfers,
    event: {
      id: bundle.event.id,
      club_id: clubId,
      name: eventName,
      date: bundle.event.date,
      status: "setup",
      course_id: courseId,
      settings: EventSettings.parse(bundle.event.settings),
    },
    entries,
    teams: bundle.teams.map((t) => ({
      id: t.id,
      event_id: bundle.event.id,
      label: t.label,
      flight: t.flight,
      status: t.status,
      sort: t.sort,
    })),
    teamMembers: bundle.teams.flatMap((t) => t.entryIds.map((entry_id, sort) => ({ team_id: t.id, entry_id, sort }))),
    rounds: bundle.rounds.map((r) => ({ id: r.id, event_id: bundle.event.id, number: r.number, mode: r.mode })),
    groups: bundle.groups.map((g) => ({
      id: g.id,
      round_id: g.roundId,
      start_hole: g.startHole,
      start_time: g.startTime,
      label: g.label,
      sort: g.sort,
    })),
    groupTeams: bundle.groups.flatMap((g) => g.teamIds.map((team_id, sort) => ({ group_id: g.id, team_id, sort }))),
    scores: bundle.scores
      .filter((s) => s.gross !== null)
      .map((s) => ({ round_id: s.roundId, team_id: s.teamId, hole: s.hole, gross: s.gross })),
  };
}
