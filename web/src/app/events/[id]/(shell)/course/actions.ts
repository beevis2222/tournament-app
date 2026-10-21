"use server";

import { revalidatePath } from "next/cache";
import { currentStaff, SIGNED_OUT } from "@/lib/db/auth";
import { validateCourse, validateTee, type CourseInput, type Errors, type TeeInput } from "@/lib/courseValidation";
import { createServerSupabase } from "@/lib/supabase/server";

/** What Undo needs after a course change: the earlier course and the tees that were cleared. */
export type CourseUndo = { courseId: string | null; tees: { entryId: string; teeId: string }[] };
export type CourseResult = { ok: true; courseId?: string; notice?: string; undo?: CourseUndo } | { ok: false; error?: string; errors?: Errors };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ids = (n: unknown) => Array.isArray(n) && n.every((x) => typeof x === "number");
const bad = (): CourseResult => ({ ok: false, error: "That didn't look right. Reload the page and try again." });

function refresh(eventId: string) {
  revalidatePath(`/events/${eventId}`, "layout");
}

/** Use a saved course for this event (null = none). Players whose tee is not on the new course need a tee picked again. */
export async function chooseCourse(eventId: string, courseId: string | null): Promise<CourseResult> {
  if (!(await currentStaff())) return { ok: false, error: SIGNED_OUT };
  const supabase = await createServerSupabase();
  const prev = await supabase.from("events").select("course_id").eq("id", eventId).maybeSingle();
  if (prev.error || !prev.data) return { ok: false, error: "Couldn't change the course. Try again." };
  const previousCourse = prev.data.course_id;
  const { data, error } = await supabase.from("events").update({ course_id: courseId }).eq("id", eventId).select("id");
  if (error || !data?.length) return { ok: false, error: "Couldn't change the course. Try again." };

  let notice: string | undefined;
  const entries = await supabase.from("entries").select("id, tee_id").eq("event_id", eventId).is("deleted_at", null).not("tee_id", "is", null);
  if (entries.error) return { ok: false, error: "Course changed, but couldn't check players' tees. Reload the page." };
  const tees = courseId ? await supabase.from("tees").select("id").eq("course_id", courseId) : { data: [], error: null };
  if (tees.error) return { ok: false, error: "Course changed, but couldn't check players' tees. Reload the page." };
  const onCourse = new Set((tees.data ?? []).map((t) => t.id));
  const staleRows = (entries.data ?? []).filter((e) => e.tee_id && !onCourse.has(e.tee_id));
  const stale = staleRows.map((e) => e.id);
  if (stale.length) {
    const cleared = await supabase.from("entries").update({ tee_id: null }).in("id", stale);
    if (cleared.error) return { ok: false, error: "Course changed, but couldn't clear players' old tees. Reload the page." };
    notice = `${stale.length} ${stale.length === 1 ? "player needs" : "players need"} a tee picked again on the Field screen.`;
  }
  refresh(eventId);
  return { ok: true, notice, undo: { courseId: previousCourse, tees: staleRows.map((e) => ({ entryId: e.id, teeId: e.tee_id as string })) } };
}

/** Reverses chooseCourse: the earlier course comes back, and so do the tees that were cleared. */
export async function undoCourse(eventId: string, undo: CourseUndo): Promise<CourseResult> {
  if (!(await currentStaff())) return { ok: false, error: SIGNED_OUT };
  const valid =
    typeof eventId === "string" &&
    UUID.test(eventId) &&
    (undo?.courseId === null || (typeof undo?.courseId === "string" && UUID.test(undo.courseId))) &&
    Array.isArray(undo.tees) &&
    undo.tees.length <= 5000 &&
    undo.tees.every((t) => typeof t?.entryId === "string" && UUID.test(t.entryId) && typeof t.teeId === "string" && UUID.test(t.teeId));
  if (!valid) return bad();
  const supabase = await createServerSupabase();
  const ev = await supabase.from("events").update({ course_id: undo.courseId }).eq("id", eventId).select("id");
  if (ev.error || !ev.data?.length) return { ok: false, error: "Couldn't undo the course change. Try again." };
  // Tees go back one tee at a time: players may have different tees.
  const byTee = new Map<string, string[]>();
  for (const t of undo.tees) byTee.set(t.teeId, [...(byTee.get(t.teeId) ?? []), t.entryId]);
  for (const [teeId, entryIds] of byTee) {
    const res = await supabase.from("entries").update({ tee_id: teeId }).in("id", entryIds).eq("event_id", eventId);
    if (res.error) return { ok: false, error: "The course came back, but some tees didn't. Check the Field screen." };
  }
  refresh(eventId);
  return { ok: true };
}

/** Saves a course. A new one (courseId null) is also chosen for this event. */
export async function saveCourse(eventId: string, courseId: string | null, input: CourseInput): Promise<CourseResult> {
  const me = await currentStaff();
  if (!me) return { ok: false, error: SIGNED_OUT };
  if (typeof input?.name !== "string" || !ids(input.pars) || !ids(input.si)) return bad();
  const errors = validateCourse(input);
  if (Object.keys(errors).length) return { ok: false, errors };

  const supabase = await createServerSupabase();
  const row = { name: input.name.trim(), pars: input.pars, si: input.si };
  if (courseId) {
    const { data, error } = await supabase.from("courses").update(row).eq("id", courseId).is("deleted_at", null).select("id");
    if (error || !data?.length) return { ok: false, error: "Couldn't save the course. Try again." };
    refresh(eventId);
    return { ok: true, courseId };
  }
  const { data, error } = await supabase.from("courses").insert({ ...row, club_id: me.clubId }).select("id").single();
  if (error || !data) return { ok: false, error: "Couldn't save the course. Try again." };
  const chosen = await chooseCourse(eventId, data.id);
  if (!chosen.ok) return chosen;
  return { ok: true, courseId: data.id, notice: chosen.notice, undo: chosen.undo };
}

/** Adds a tee (teeId null) or changes one. Tees cannot be removed: the tees table has no deleted_at column. */
export async function saveTee(eventId: string, courseId: string, teeId: string | null, input: TeeInput): Promise<CourseResult> {
  if (!(await currentStaff())) return { ok: false, error: SIGNED_OUT };
  if (
    typeof input?.name !== "string" ||
    typeof input.rating !== "number" ||
    typeof input.slope !== "number" ||
    (input.pars !== null && !ids(input.pars)) ||
    (input.si !== null && !ids(input.si))
  ) {
    return bad();
  }
  const errors = validateTee(input);
  if (Object.keys(errors).length) return { ok: false, errors };

  const supabase = await createServerSupabase();
  const row = { name: input.name.trim(), rating: input.rating, slope: input.slope, pars: input.pars, si: input.si };
  const res = teeId
    ? await supabase.from("tees").update(row).eq("id", teeId).eq("course_id", courseId).select("id")
    : await supabase.from("tees").insert({ ...row, course_id: courseId }).select("id");
  if (res.error || !res.data?.length) return { ok: false, error: "Couldn't save the tee. Try again." };
  refresh(eventId);
  return { ok: true };
}
