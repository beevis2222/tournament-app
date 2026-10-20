"use server";

import { redirect } from "next/navigation";
import { currentStaff, SIGNED_OUT } from "@/lib/db/auth";
import { TEMPLATES } from "@/lib/templates";
import { createServerSupabase } from "@/lib/supabase/server";
import { EventSettings } from "@/lib/types";

export type CreateResult = { error: string };

/** Makes an event (dated `today`, the browser's local date) (and one rounds row per round) from a template, then opens its Details. */
export async function createEvent(templateId: string, today: string): Promise<CreateResult> {
  const me = await currentStaff();
  if (!me) return { error: SIGNED_OUT };
  const template = TEMPLATES.find((t) => t.id === templateId);
  if (!template || !template.available) return { error: "That template isn't ready yet." };

  const settings = EventSettings.parse(template.settings);
  const supabase = await createServerSupabase();
  const { data: event, error } = await supabase
    .from("events")
    .insert({
      club_id: me.clubId,
      name: template.id === "blank" ? "New scramble" : template.name,
      date: /^d{4}-d{2}-d{2}$/.test(today) ? today : new Date().toISOString().slice(0, 10),
      settings,
    })
    .select("id")
    .single();
  if (error || !event) return { error: "Couldn't create the event. Try again." };

  const { error: roundsError } = await supabase
    .from("rounds")
    .insert(Array.from({ length: settings.rounds }, (_, i) => ({ event_id: event.id, number: i + 1 })));
  if (roundsError) {
    // Don't leave an event with no rounds behind.
    await supabase.from("events").update({ deleted_at: new Date().toISOString() }).eq("id", event.id);
    return { error: "Couldn't create the event. Try again." };
  }

  redirect(`/events/${event.id}/details`);
}
