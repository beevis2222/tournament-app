import { createServerSupabase, getStaff } from "@/lib/supabase/server";
import StaffManager from "./StaffManager";

function LoadError() {
  return (
    <main className="page">
      <h1>Staff</h1>
      <p className="error" role="alert">Couldn&apos;t load the staff list.</p>
      <p><a href="/settings/staff">Retry</a></p>
    </main>
  );
}

export default async function StaffPage() {
  let me;
  try {
    me = await getStaff();
  } catch {
    return <LoadError />;
  }
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
  const { data, error } = await supabase
    .from("staff")
    .select("id, email, role, user_id")
    .is("removed_at", null)
    .order("invited_at");
  if (error) return <LoadError />;

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
