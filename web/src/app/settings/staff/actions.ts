"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getStaff } from "@/lib/supabase/server";

export type ActionResult = { error?: string };

export async function addStaffEmail(rawEmail: string): Promise<ActionResult> {
  const me = await getStaff();
  if (!me || me.role !== "pro") return { error: "Only the pro can manage staff." };
  const email = rawEmail.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "That doesn't look like an email address." };

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("staff").insert({ club_id: me.clubId, email });
  if (error) {
    if (error.code !== "23505") return { error: "Couldn't add that email. Try again." };
    // Already on the list: bring them back if they were removed.
    const { data, error: updateError } = await supabase
      .from("staff")
      .update({ removed_at: null })
      .eq("club_id", me.clubId)
      .eq("email", email)
      .not("removed_at", "is", null)
      .select("id");
    if (updateError) return { error: "Couldn't add that email. Try again." };
    if (!data?.length) return { error: "That email is already on the list." };
  }
  revalidatePath("/settings/staff");
  return {};
}

export async function setStaffRemoved(staffId: string, removed: boolean): Promise<ActionResult> {
  const me = await getStaff();
  if (!me || me.role !== "pro") return { error: "Only the pro can manage staff." };
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("staff")
    .update({ removed_at: removed ? new Date().toISOString() : null })
    .eq("id", staffId)
    .eq("club_id", me.clubId)
    .neq("user_id", me.userId);
  if (error) return { error: "Couldn't update that person. Try again." };
  revalidatePath("/settings/staff");
  return {};
}
