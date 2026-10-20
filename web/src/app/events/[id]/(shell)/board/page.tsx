import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Board } from "@/components/Board";
import { buildFlights } from "@/lib/boards";
import { EVENT_NOT_FOUND, loadEvent } from "@/lib/db/events";
import { hasCourse } from "@/lib/toEngine";

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let bundle;
  try {
    bundle = await loadEvent(id);
  } catch (e) {
    if (e instanceof Error && e.message === EVENT_NOT_FOUND) notFound();
    throw e;
  }

  return (
    <>
      <h2 style={{ marginTop: 0 }}>
        Leaderboard
        {bundle.event.status === "final" && <span className="badge-final">Final</span>}
      </h2>
      {hasCourse(bundle) ? (
        <>
          <AutoRefresh seconds={15} />
          <Board flights={buildFlights(bundle)} />
          {bundle.event.status !== "final" && <p className="muted">Prizes are provisional until the event is final.</p>}
          <p className="muted">Updates every 15 seconds.</p>
        </>
      ) : (
        <p className="note">
          Choose a course first. <Link href={`/events/${id}/course`}>Choose a course</Link>
        </p>
      )}
    </>
  );
}
