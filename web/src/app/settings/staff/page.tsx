import { createServerSupabase, getStaff } from "@/lib/supabase/server";
import StaffManager from "./StaffManager";

export default async function StaffPage() {
  const me = await getStaff();
  if (!me) return null; // the middleware sends signed-out people to sign-in
  if (me.role !== "pro") {
    return (
      <main className="page">
        <h1>Staff</h1>
        <p>Only the pro can manage staff.</p>
      </main>
    );
  }

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("staff")
    .select("id, email, role, user_id")
    .is("removed_at", null)
    .order("invited_at");

  const rows = (data ?? []).map((s) => ({
    id: s.id,
    email: s.email,
    role: s.role,
    signedUp: s.user_id !== null,
    isMe: s.user_id === me.userId,
  }));

  return (
    <main className="page">
      <h1>Staff</h1>
      <StaffManager rows={rows} />
    </main>
  );
}
