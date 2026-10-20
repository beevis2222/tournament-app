import { notFound } from "next/navigation";
import { EVENT_NOT_FOUND, loadEvent } from "@/lib/db/events";
import { fetchAll } from "@/lib/db/paging";
import { limitWarnings } from "@/lib/teamPlan";
import { hasCourse } from "@/lib/toEngine";
import { createServerSupabase } from "@/lib/supabase/server";
import FieldView from "./FieldView";

export default async function FieldPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let bundle;
  try {
    bundle = await loadEvent(id);
  } catch (e) {
    if (e instanceof Error && e.message === EVENT_NOT_FOUND) notFound();
    throw e;
  }

  const supabase = await createServerSupabase();
  const golfers = await fetchAll((from, to) =>
    supabase.from("golfers").select("id, name, index, nh").is("deleted_at", null).order("name").order("id").range(from, to),
  );
  if (golfers.error) throw new Error("Couldn't load the club roster");
  const inField = new Set(bundle.entries.map((e) => e.golferId));
  const roster = (golfers.data ?? [])
    .filter((g) => !inField.has(g.id))
    .map((g) => ({ id: g.id, name: g.name, index: g.index === null ? null : Number(g.index), nh: g.nh }));

  const course = hasCourse(bundle);
  const warnings = course ? Object.fromEntries(limitWarnings(bundle)) : {};

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Field</h2>
      <FieldView
        eventId={id}
        teeNames={bundle.tees.map((t) => t.name)}
        tees={bundle.tees.map((t) => ({ id: t.id, name: t.name }))}
        teamMode={bundle.event.settings.teamMode}
        teamCount={bundle.teams.length}
        entries={bundle.entries}
        roster={roster}
        hasCourse={course}
        warnings={warnings}
      />
    </>
  );
}
