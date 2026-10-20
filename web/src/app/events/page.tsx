import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import EventsView, { type EventRow } from "./EventsView";

function LoadError() {
  return (
    <main className="page">
      <h1>Events</h1>
      <p className="error" role="alert">Couldn&apos;t load your events.</p>
      <p><Link href="/events">Retry</Link></p>
    </main>
  );
}

export default async function EventsPage() {
  const supabase = await createServerSupabase();
  const [live, removed] = await Promise.all([
    supabase.from("events").select("id, name, date, status").is("deleted_at", null),
    supabase
      .from("events")
      .select("id, name, date, status")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(20),
  ]);
  if (live.error || removed.error) return <LoadError />;

  const rows = (live.data ?? []) as EventRow[];

  return (
    <div className="wrap">
      <header className="shell-head">
        <div className="hdrow">
          <h1>Events</h1>
          <Link className="evbtn" href="/settings">Settings</Link>
        </div>
      </header>
      <EventsView events={rows} deleted={(removed.data ?? []) as EventRow[]} />
    </div>
  );
}
