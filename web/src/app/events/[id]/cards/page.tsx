import Link from "next/link";
import { notFound } from "next/navigation";
import { EVENT_NOT_FOUND, loadEvent } from "@/lib/db/events";
import { hasCourse, toEngine } from "@/lib/toEngine";
import CardsView from "./CardsView";

export default async function CardsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let bundle;
  try {
    bundle = await loadEvent(id);
  } catch (e) {
    if (e instanceof Error && e.message === EVENT_NOT_FOUND) notFound();
    throw e;
  }

  if (!hasCourse(bundle)) {
    return (
      <>
        <h2 style={{ marginTop: 0 }}>Enter cards</h2>
        <p className="note">
          <Link href={`/events/${id}/course`}>Choose a course first</Link> so scores can be worked out.
        </p>
      </>
    );
  }

  const ev = toEngine(bundle);
  // Rounds are in number order, the same order the engine uses.
  const rounds = [...bundle.rounds].sort((a, b) => a.number - b.number).map((r) => ({ id: r.id, number: r.number }));
  // Teams with at least one player who is not an alternate.
  const playing = new Set(ev.teams.filter((t) => t.playerIds.length > 0).map((t) => t.id));

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Enter cards</h2>
      {playing.size === 0 ? (
        <p className="muted">No teams to score yet. Make teams on the Teams screen first.</p>
      ) : (
        <CardsView ev={ev} rounds={rounds} teamIds={[...playing]} />
      )}
    </>
  );
}
