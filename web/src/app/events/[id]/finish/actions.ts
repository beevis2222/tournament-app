"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentStaff, SIGNED_OUT } from "@/lib/db/auth";
import { createServerSupabase } from "@/lib/supabase/server";

type Fail = { ok: false; error: string };
const STATUS = z.enum(["setup", "live", "final"]);
export type EventStatus = z.infer<typeof STATUS>;

/** Sets the event's status and says what it was, so Undo can put it back. */
export async function setEventStatus(eventId: string, status: EventStatus): Promise<{ ok: true; previous: EventStatus } | Fail> {
  if (!(await currentStaff())) return { ok: false, error: SIGNED_OUT };
  const parsed = z.object({ id: z.string().uuid(), status: STATUS }).safeParse({ id: eventId, status });
  if (!parsed.success) return { ok: false, error: "That didn't look right. Reload the page and try again." };
  const supabase = await createServerSupabase();
  const failed: Fail = { ok: false, error: "That didn't save. Try again." };

  const cur = await supabase.from("events").select("status").eq("id", eventId).is("deleted_at", null).maybeSingle();
  if (cur.error) return failed;
  if (!cur.data) return { ok: false, error: "That event wasn't found." };
  const { data, error } = await supabase.from("events").update({ status }).eq("id", eventId).select("id");
  if (error || !data?.length) return failed;
  revalidatePath(`/events/${eventId}`, "layout");
  return { ok: true, previous: STATUS.parse(cur.data.status) };
}
