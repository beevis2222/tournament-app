"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getStaff } from "@/lib/supabase/server";

/** Tables that remove rows by setting deleted_at. */
const TABLES = ["events", "courses", "golfers", "entries", "teams"] as const;
export type SoftTable = (typeof TABLES)[number];

async function setDeleted(table: SoftTable, id: string, when: string | null): Promise<{ error?: string }> {
  if (!TABLES.includes(table)) return { error: "That can't be removed." };
  try {
    if (!(await getStaff())) return { error: "You are signed out. Sign in again." };
  } catch {
    return { error: "Couldn't check your sign-in. Try again." };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from(table).update({ deleted_at: when }).eq("id", id).select("id");
  if (error || !data?.length) return { error: "That didn't save. Try again." };
  revalidatePath("/", "layout");
  return {};
}

/** Remove = set deleted_at. Every Undo calls restore(). */
export async function softDelete(table: SoftTable, id: string) {
  return setDeleted(table, id, new Date().toISOString());
}

export async function restore(table: SoftTable, id: string) {
  return setDeleted(table, id, null);
}
