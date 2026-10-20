"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentStaff, SIGNED_OUT } from "@/lib/db/auth";
import { createServerSupabase } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

const SAVE_FAILED = "That didn't save. Check your connection and try again.";
const BAD = "That didn't look right. Reload the page and try again.";
const refresh = () => revalidatePath("/events/[id]", "layout");
const uuid = z.string().uuid();

/** Saves (or, with null, clears) one team's gross score on one hole. Every change is logged by the database. */
export async function saveScore(roundId: string, teamId: string, hole: number, gross: number | null): Promise<Result> {
  const ok =
    uuid.safeParse(roundId).success &&
    uuid.safeParse(teamId).success &&
    Number.isInteger(hole) && hole >= 1 && hole <= 18 &&
    (gross === null || (Number.isInteger(gross) && gross >= 1 && gross <= 20));
  if (!ok) return { ok: false, error: BAD };
  const supabase = await createServerSupabase();
  // Speed matters here: one sign-in check, then the save. The database limits the write to this club's rows
  // and rejects a round and team from different events (cross_event_reference).
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: SIGNED_OUT };
  // The generated type says p_gross is a number; null clears the hole.
  const { error } = await supabase.rpc("save_score", {
    p_round: roundId,
    p_team: teamId,
    p_hole: hole,
    p_gross: gross as number,
    p_screen: "enter-cards",
  });
  if (error) return { ok: false, error: error.message.includes("cross_event_reference") ? BAD : SAVE_FAILED };
  // No revalidate here: the cards view keeps its own state, and the other screens load fresh.
  return { ok: true };
}

/** Full, Front 9 only, Back 9 only or Called off. Scores already entered are kept. */
export async function setRoundMode(eventId: string, roundId: string, mode: string): Promise<Result> {
  if (!(await currentStaff())) return { ok: false, error: SIGNED_OUT };
  const m = z.enum(["full", "front", "back", "called_off"]).safeParse(mode);
  if (!uuid.safeParse(eventId).success || !uuid.safeParse(roundId).success || !m.success) return { ok: false, error: BAD };
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("rounds").update({ mode: m.data }).eq("id", roundId).eq("event_id", eventId).select("id");
  if (error || !data?.length) return { ok: false, error: SAVE_FAILED };
  refresh();
  return { ok: true };
}

/** null = playing; otherwise WD, DQ or NS (no show). */
export async function setTeamStatus(eventId: string, teamId: string, status: string | null): Promise<Result> {
  if (!(await currentStaff())) return { ok: false, error: SIGNED_OUT };
  const s = z.enum(["WD", "DQ", "NS"]).nullable().safeParse(status);
  if (!uuid.safeParse(eventId).success || !uuid.safeParse(teamId).success || !s.success) return { ok: false, error: BAD };
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("teams").update({ status: s.data }).eq("id", teamId).eq("event_id", eventId).is("deleted_at", null).select("id");
  if (error || !data?.length) return { ok: false, error: SAVE_FAILED };
  refresh();
  return { ok: true };
}
