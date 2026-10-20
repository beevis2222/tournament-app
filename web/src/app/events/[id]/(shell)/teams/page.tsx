import { notFound } from "next/navigation";
import { EVENT_NOT_FOUND, loadEvent } from "@/lib/db/events";
import { flightName, teamHandicaps } from "@/lib/teamPlan";
import { hasCourse } from "@/lib/toEngine";
import TeamsView, { type PlayerRow, type TeamRow } from "./TeamsView";

export default async function TeamsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let bundle;
  try {
    bundle = await loadEvent(id);
  } catch (e) {
    if (e instanceof Error && e.message === EVENT_NOT_FOUND) notFound();
    throw e;
  }

  const { settings } = bundle.event;
  const course = hasCourse(bundle);
  const handicaps = course && bundle.teams.length ? teamHandicaps(bundle) : new Map<string, number>();

  const byId = new Map(bundle.entries.map((e) => [e.id, e]));
  const row = (entryId: string): PlayerRow => {
    const e = byId.get(entryId)!;
    return { id: e.id, name: e.name, index: e.indexUsed, nh: e.nh };
  };
  const teams: TeamRow[] = bundle.teams.map((t) => ({
    id: t.id,
    label: t.label,
    status: t.status,
    handicap: handicaps.get(t.id) ?? null,
    flight: t.flight === null ? null : flightName(settings.flightNames, t.flight),
    players: t.entryIds.filter((eid) => byId.has(eid) && !byId.get(eid)!.alternate).map(row),
  }));
  const onATeam = new Set(teams.flatMap((t) => t.players.map((p) => p.id)));
  const alternates = bundle.entries.filter((e) => e.alternate).map((e) => row(e.id));
  const unassigned = bundle.entries.filter((e) => !e.alternate && !onATeam.has(e.id)).map((e) => row(e.id));

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Teams</h2>
      <TeamsView
        eventId={id}
        teamMode={settings.teamMode}
        teamSize={settings.teamSize}
        flights={settings.flights}
        hasCourse={course}
        fieldCount={bundle.entries.length}
        teams={teams}
        alternates={alternates}
        unassigned={unassigned}
      />
    </>
  );
}
