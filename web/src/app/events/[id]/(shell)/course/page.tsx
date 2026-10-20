import { notFound } from "next/navigation";
import { EVENT_NOT_FOUND, loadEvent } from "@/lib/db/events";
import { createServerSupabase } from "@/lib/supabase/server";
import CourseEditor from "./CourseEditor";

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let bundle;
  try {
    bundle = await loadEvent(id);
  } catch (e) {
    if (e instanceof Error && e.message === EVENT_NOT_FOUND) notFound();
    throw e;
  }

  const supabase = await createServerSupabase();
  const { data: courses, error } = await supabase.from("courses").select("id, name").is("deleted_at", null).order("name");
  if (error) throw new Error("Couldn't load the saved courses");

  const { course, tees } = bundle;
  const current = course.id === "" ? null : { id: course.id, name: course.name, pars: course.pars, si: course.si };
  const teamIds = new Set(bundle.teams.map((t) => t.id));
  const needsConfirm = bundle.entries.some((e) => e.teeId !== null) || bundle.scores.some((s) => teamIds.has(s.teamId) && s.gross !== null);
  return (
    <>
      <h2 style={{ marginTop: 0 }}>Course &amp; tees</h2>
      <CourseEditor key={course.id || "none"} eventId={id} courses={courses ?? []} current={current} tees={tees} needsConfirm={needsConfirm} />
    </>
  );
}
