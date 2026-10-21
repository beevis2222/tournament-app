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

const RECENT = 20;

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const showAll = (await searchParams).all === "1";
  const supabase = await createServerSupabase();
  const [live, removed] = await Promise.all([
    supabase.from("events").select("id, name, date, status").is("deleted_at", null),
    supabase
      .from("events")
      .select("id, name, date, status")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(showAll ? 2000 : RECENT + 1),
  ]);
  if (live.error || removed.error) return <LoadError />;

  const rows = (live.data ?? []) as EventRow[];
  const removedRows = (removed.data ?? []) as EventRow[];
  const hasMore = !showAll && removedRows.length > RECENT;

  return (
    <div className="wrap">
      <header className="shell-head">
        <div className="hdrow">
          <h1>Events</h1>
          <Link className="evbtn" href="/settings">Settings</Link>
        </div>
      </header>
      <EventsView events={rows} deleted={showAll ? removedRows : removedRows.slice(0, RECENT)} hasMoreDeleted={hasMore} showingAllDeleted={showAll} />
    </div>
  );
}
