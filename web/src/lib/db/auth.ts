import { getStaff, type StaffInfo } from "@/lib/supabase/server";

/** For server actions: the signed-in staff member, or null when signed out or on a database error. */
export async function currentStaff(): Promise<StaffInfo | null> {
  try {
    return await getStaff();
  } catch {
    return null;
  }
}

export const SIGNED_OUT = "You are signed out. Sign in again.";
