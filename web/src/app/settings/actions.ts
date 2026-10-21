"use server";

import { revalidatePath } from "next/cache";
import { currentStaff, SIGNED_OUT } from "@/lib/db/auth";
import { createServerSupabase } from "@/lib/supabase/server";

export async function renameClub(raw: string): Promise<{ error?: string }> {
  const me = await currentStaff();
  if (!me) return { error: SIGNED_OUT };
  const name = String(raw ?? "").trim();
  if (!name) return { error: "Type a club name." };
  if (name.length > 120) return { error: "That name is too long." };
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("clubs").update({ name }).eq("id", me.clubId).select("id");
  if (error || !data?.length) return { error: "That didn't save. Try again." };
  revalidatePath("/settings");
  return {};
}
