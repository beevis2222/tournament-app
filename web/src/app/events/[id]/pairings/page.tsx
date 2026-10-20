import { notFound } from "next/navigation";
import { EVENT_NOT_FOUND, loadEvent } from "@/lib/db/events";
import { hasCourse } from "@/lib/toEngine";
import { startMatchesType } from "@/lib/pairingEdit";
import { fmtTime, preEventCheck, startLabel } from "@/lib/pairings";
import PairingsView, { type GroupRow, type RoundRow, type TeamChip } from "./PairingsView";

/** Sort key for a start: tee times by time, holes by number then A/B. */
function startOrder(g: { startHole: string | null; startTime: string | null }): [number, string] {
  if (g.startTime) return [Number(g.startTime.replace(":", "")), ""];
  const m = /^(\d+)(.*)$/.exec(g.startHole ?? "");
  return m ? [Number(m[1]), m[2]] : [Infinity, ""];
}

export default async function PairingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let bundle;
  try {
    bundle = await loadEvent(id);
  } catch (e) {
    if (e instanceof Error && e.message === EVENT_NOT_FOUND) notFound();
    throw e;
  }

  const entryName = new Map(bundle.entries.map((e) => [e.id, e.name]));
  const alternates = new Set(bundle.entries.filter((e) => e.alternate).map((e) => e.id));
  const chip = (teamId: string): TeamChip | null => {
    const t = bundle.teams.find((x) => x.id === teamId);
    if (!t) return null;
    return { id: t.id, label: t.label, players: t.entryIds.filter((eid) => !alternates.has(eid)).map((eid) => entryName.get(eid) ?? "") };
  };

  const { settings } = bundle.event;
  const rounds: RoundRow[] = bundle.rounds.map((r) => {
    const groups: GroupRow[] = bundle.groups
      .filter((g) => g.roundId === r.id)
      .sort((a, b) => {
        const [x, xs] = startOrder(a);
        const [y, ys] = startOrder(b);
        return x - y || xs.localeCompare(ys) || a.sort - b.sort;
      })
      .map((g) => ({
        id: g.id,
        label: g.label,
        start: g.startHole ?? (g.startTime ? fmtTime(g.startTime) : "No start"),
        startValue: g.startHole ?? g.startTime ?? "",
        startMismatch: !startMatchesType(settings.start, g),
        teams: g.teamIds.map(chip).filter((c): c is TeamChip => c !== null),
      }));
    const placed = new Set(groups.flatMap((g) => g.teams.map((t) => t.id)));
    const unplaced = bundle.teams.filter((t) => !placed.has(t.id)).map((t) => chip(t.id)!);
    return { number: r.number, groups, unplaced };
  });

  const total = bundle.teams.length;
  const preview = Array.from({ length: Math.min(total, 3) }, (_, i) => startLabel(i, total, settings));

  // With no course chosen the placeholder pars would pass the check, so show it as missing.
  const problems = preEventCheck(hasCourse(bundle) ? bundle : { ...bundle, course: { ...bundle.course, pars: [] } });

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Pairings</h2>
      <PairingsView eventId={id} startType={settings.start} teamCount={total} preview={preview} rounds={rounds} problems={problems} />
    </>
  );
}
