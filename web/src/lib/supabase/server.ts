import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

export async function createServerSupabase(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component; the middleware refreshes the session instead.
          }
        },
      },
    },
  );
}

export type StaffInfo = { userId: string; clubId: string; role: "pro" | "staff" };

export async function getStaff(): Promise<StaffInfo | null> {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from("staff")
    .select("club_id, role")
    .eq("user_id", auth.user.id)
    .is("removed_at", null)
    .maybeSingle();
  if (error) throw new Error("staff lookup failed");
  if (!data) return null;
  return { userId: auth.user.id, clubId: data.club_id, role: data.role as "pro" | "staff" };
}
