import type { Player, ScrambleEvent, Team, TeamCards, Tee } from "@starter/scoring";
import type { EventBundle } from "./types";

/** False until a course has been chosen for the event; screens show a "Choose a course" prompt instead of calling toEngine. */
export function hasCourse(b: EventBundle): boolean {
  return b.course.id !== "";
}

/** Turns the app's stored rows into the event the scoring engine expects. */
export function toEngine(b: EventBundle): ScrambleEvent {
  if (!hasCourse(b)) throw new Error("Choose a course for this event first.");
  const { settings } = b.event;

  const tees: Tee[] = b.tees.map((t) => ({
    id: t.id,
    name: t.name,
    rating: t.rating,
    slope: t.slope,
    ...(t.pars ? { pars: t.pars } : {}),
    ...(t.si ? { si: t.si } : {}),
  }));

  // Alternates are on standby: not players, and never on a team.
  const playing = b.entries.filter((e) => !e.alternate);
  const playingIds = new Set(playing.map((e) => e.id));

  const players: Player[] = playing.map((e) => ({
    id: e.id,
    name: e.name,
    index: e.indexUsed,
    ...(e.nh ? { nh: true } : {}),
    ...(e.teeId ? { teeId: e.teeId } : {}),
  }));

  const teams: Team[] = [...b.teams]
    .sort((a, c) => a.sort - c.sort)
    .map((t) => ({
      id: t.id,
      name: t.label,
      playerIds: t.entryIds.filter((id) => playingIds.has(id)),
      ...(t.status ? { status: t.status } : {}),
      ...(t.flight !== null ? { flight: t.flight } : {}),
    }));

  const rounds = [...b.rounds].sort((a, c) => a.number - c.number);
  const cards: TeamCards[] = rounds.map(() => ({}));
  const roundIndex = new Map(rounds.map((r, i) => [r.id, i]));
  for (const s of b.scores) {
    const ri = roundIndex.get(s.roundId);
    if (ri === undefined || s.hole < 1 || s.hole > 18) continue;
    const card = (cards[ri][s.teamId] ??= Array(18).fill(null));
    card[s.hole - 1] = s.gross;
  }

  return {
    teamHandicap: settings.teamHandicap,
    maxTeamHandicap: settings.maxTeamHandicap,
    course: { pars: b.course.pars, si: b.course.si, tees },
    players,
    teams,
    holes: settings.holes,
    rounds: rounds.map((r) => r.mode),
    limits: settings.limits,
    scores: cards,
  };
}
