import Link from "next/link";
import { notFound } from "next/navigation";
import { Winners } from "@/components/Board";
import { buildFlights, unsplitFlights, unsplitWarning } from "@/lib/boards";
import { csvFilename } from "@/lib/csv";
import { EVENT_NOT_FOUND, loadEvent } from "@/lib/db/events";
import { hasCourse } from "@/lib/toEngine";
import FinishView from "./FinishView";

export default async function FinishPage({ params }: { params: Promise<{ id: string }> }) {
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
      <h2 style={{ marginTop: 0 }}>Finish</h2>
      {hasCourse(bundle) ? (
        <>
          {unsplitFlights(bundle) > 0 && <p className="note">{unsplitWarning(unsplitFlights(bundle))}</p>}
          <h3>Prize winners</h3>
          <Winners flights={buildFlights(bundle)} final={bundle.event.status === "final"} />
          <FinishView eventId={id} status={bundle.event.status} csvName={csvFilename(bundle.event.name)} />
        </>
      ) : (
        <p className="note">
          Choose a course first. <Link href={`/events/${id}/course`}>Choose a course</Link>
        </p>
      )}
    </>
  );
}
