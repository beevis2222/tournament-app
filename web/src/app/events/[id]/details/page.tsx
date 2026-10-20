import Link from "next/link";
import { notFound } from "next/navigation";
import { EVENT_NOT_FOUND, loadEvent } from "@/lib/db/events";
import { valuesFromSettings } from "@/lib/detailsForm";
import DetailsForm from "./DetailsForm";

export default async function DetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let bundle;
  try {
    bundle = await loadEvent(id);
  } catch (e) {
    if (e instanceof Error && e.message === EVENT_NOT_FOUND) notFound();
    throw e;
  }
  const { event, course, tees } = bundle;

  return (
    <>
      {course.id === "" ? (
        <p className="note">
          No course yet. <Link href={`/events/${id}/course`}>Choose a course</Link> so handicaps can be worked out.
        </p>
      ) : (
        <p>
          Course: <strong>{course.name}</strong> ({tees.length} {tees.length === 1 ? "tee" : "tees"}).{" "}
          <Link href={`/events/${id}/course`}>Change course or tees</Link>
        </p>
      )}
      <DetailsForm eventId={id} initial={valuesFromSettings(event.name, event.date, event.settings)} />
    </>
  );
}
