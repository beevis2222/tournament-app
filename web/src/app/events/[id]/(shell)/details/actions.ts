"use server";

import { revalidatePath } from "next/cache";
import { currentStaff, SIGNED_OUT } from "@/lib/db/auth";
import { parseDetails, type DetailsValues } from "@/lib/detailsForm";
import { createServerSupabase } from "@/lib/supabase/server";

export type SaveDetailsResult = { ok: true } | { ok: false; error?: string; errors?: Record<string, string> };

/**
 * Saves the Details form. Rounds above the new count are kept in the database
 * (nothing is deleted); loadEvent leaves them out until the count goes back up.
 */
export async function saveDetails(eventId: string, values: DetailsValues): Promise<SaveDetailsResult> {
  if (!(await currentStaff())) return { ok: false, error: SIGNED_OUT };
  const parsed = parseDetails(values);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("events")
    .update({ name: parsed.name, date: parsed.date, settings: parsed.settings })
    .eq("id", eventId)
    .is("deleted_at", null)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Couldn't save the details. Try again." };

  const existing = await supabase.from("rounds").select("number").eq("event_id", eventId);
  if (existing.error) return { ok: false, error: "Saved, but couldn't check the rounds. Save again." };
  const have = new Set((existing.data ?? []).map((r) => r.number));
  const missing = Array.from({ length: parsed.settings.rounds }, (_, i) => i + 1).filter((n) => !have.has(n));
  if (missing.length) {
    const { error: insertError } = await supabase
      .from("rounds")
      .insert(missing.map((number) => ({ event_id: eventId, number })));
    if (insertError) return { ok: false, error: "Saved, but couldn't add the new rounds. Save again." };
  }

  revalidatePath(`/events/${eventId}`, "layout");
  return { ok: true };
}
