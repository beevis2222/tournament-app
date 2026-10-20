import { notFound } from "next/navigation";
import Shell from "@/components/Shell";
import { EVENT_NOT_FOUND, loadEvent } from "@/lib/db/events";
import { eventSubtitle, progressSteps } from "@/lib/progress";

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let bundle;
  try {
    bundle = await loadEvent(id);
  } catch (e) {
    if (e instanceof Error && e.message === EVENT_NOT_FOUND) notFound();
    throw e;
  }
  return (
    <Shell eventId={id} name={bundle.event.name} subtitle={eventSubtitle(bundle)} steps={progressSteps(bundle)}>
      {children}
    </Shell>
  );
}
