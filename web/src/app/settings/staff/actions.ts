"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getStaff, type StaffInfo } from "@/lib/supabase/server";

export type ActionResult = { error?: string };

const ONLY_PRO = "Only the pro can manage staff.";

async function currentPro(): Promise<StaffInfo | null> {
  try {
    const me = await getStaff();
    return me && me.role === "pro" ? me : null;
  } catch {
    return null;
  }
}

export async function addStaffEmail(rawEmail: string): Promise<ActionResult> {
  const me = await currentPro();
  if (!me) return { error: ONLY_PRO };
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
  const me = await currentPro();
  if (!me) return { error: ONLY_PRO };
  const supabase = await createServerSupabase();
  // Never let the pro remove themself. Invited people have no user_id yet, so allow NULL explicitly.
  const { data, error } = await supabase
    .from("staff")
    .update({ removed_at: removed ? new Date().toISOString() : null })
    .eq("id", staffId)
    .eq("club_id", me.clubId)
    .or(`user_id.is.null,user_id.neq.${me.userId}`)
    .select("id");
  if (error || !data?.length) return { error: "Couldn't update that person. Try again." };
  revalidatePath("/settings/staff");
  return {};
}
