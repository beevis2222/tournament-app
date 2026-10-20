import { csvFilename, eventCsv } from "@/lib/csv";
import { EVENT_NOT_FOUND, loadEvent } from "@/lib/db/events";
import { getStaff } from "@/lib/supabase/server";
import { hasCourse } from "@/lib/toEngine";

const text = (body: string, status: number) => new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let staff;
  try {
    staff = await getStaff();
  } catch {
    return text("Couldn't check your sign-in. Try again.", 500);
  }
  if (!staff) return text("You are signed out. Sign in again.", 401);

  const { id } = await params;
  let bundle;
  try {
    bundle = await loadEvent(id);
  } catch (e) {
    if (e instanceof Error && e.message === EVENT_NOT_FOUND) return text("That event wasn't found.", 404);
    return text("Couldn't load the event. Try again.", 500);
  }
  if (!hasCourse(bundle)) return text("Choose a course first.", 400);

  // The leading byte order mark lets Excel read it as UTF-8.
  return new Response("﻿" + eventCsv(bundle), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename(bundle.event.name)}"`,
      "Cache-Control": "no-store",
    },
  });
}
