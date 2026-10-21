import Link from "next/link";
import { createServerSupabase, getStaff } from "@/lib/supabase/server";
import ClubNameForm from "./ClubNameForm";

function LoadError() {
  return (
    <main className="page">
      <h1>Settings</h1>
      <p className="error" role="alert">Couldn&apos;t load your settings.</p>
      <p><Link href="/settings">Retry</Link></p>
    </main>
  );
}

export default async function SettingsPage() {
  let me;
  try {
    me = await getStaff();
  } catch {
    return <LoadError />;
  }
  if (!me) return null; // the middleware sends signed-out people to sign-in

  const supabase = await createServerSupabase();
  const { data: club, error } = await supabase.from("clubs").select("name").eq("id", me.clubId).maybeSingle();
  if (error || !club) return <LoadError />;

  return (
    <main className="page">
      <p><Link href="/events">&larr; Events</Link></p>
      <h1>Settings</h1>
      {/* Any staff member may rename the club (clubs_update allows the whole club). */}
      <ClubNameForm name={club.name} />
      <h2>More</h2>
      <ul>
        <li><Link href="/settings/staff">Staff</Link></li>
        <li><Link href="/settings/import">Import prototype backup</Link></li>
      </ul>
    </main>
  );
}
