"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Toast } from "@/components/Toast";
import { localDate } from "@/lib/dates";
import { restore, softDelete } from "@/lib/db/softDelete";
import { TEMPLATES } from "@/lib/templates";
import { createEvent } from "./new/actions";

export type EventRow = { id: string; name: string; date: string; status: string };

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function EventList({ rows, onDelete, busy }: { rows: EventRow[]; onDelete: (e: EventRow) => void; busy: boolean }) {
  return (
    <>
      {rows.map((e) => (
        <div className="ev-row" key={e.id}>
          <div>
            <Link className="name" href={`/events/${e.id}/details`}>{e.name}</Link>
            <div className="muted">
              {formatDate(e.date)}
              {e.status === "final" ? " · Final" : e.status === "live" ? " · In progress" : ""}
            </div>
          </div>
          <button className="btn-quiet" type="button" disabled={busy} onClick={() => onDelete(e)}>Delete</button>
        </div>
      ))}
    </>
  );
}

export default function EventsView({ events, deleted }: { events: EventRow[]; deleted: EventRow[] }) {
  // Split by the browser's local date so an evening event is not "past" (the server runs in UTC).
  const today = localDate();
  const upcoming = events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = events.filter((e) => e.date < today).sort((a, b) => b.date.localeCompare(a.date));
  const router = useRouter();
  const [error, setError] = useState("");
  const [undo, setUndo] = useState<EventRow | null>(null);
  const [pending, startTransition] = useTransition();

  function create(templateId: string) {
    setError("");
    startTransition(async () => {
      const result = await createEvent(templateId, localDate()); // redirects on success
      if (result?.error) setError(result.error);
    });
  }

  function remove(e: EventRow) {
    startTransition(async () => {
      const result = await softDelete("events", e.id);
      setError(result.error ?? "");
      if (!result.error) {
        setUndo(e);
        router.refresh();
      }
    });
  }

  function put(e: EventRow) {
    setUndo(null);
    startTransition(async () => {
      const result = await restore("events", e.id);
      setError(result.error ?? "");
      router.refresh();
    });
  }

  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}

      <h2>Start a new event</h2>
      <div className="tpl-grid">
        {TEMPLATES.map((t) => (
          <button key={t.id} type="button" className="tpl" disabled={!t.available || pending} onClick={() => create(t.id)}>
            <strong>{t.name}</strong>
            <small>{t.desc}</small>
            {!t.available && <span className="soon">Coming soon</span>}
          </button>
        ))}
      </div>

      <h2>Upcoming</h2>
      {upcoming.length ? <EventList rows={upcoming} onDelete={remove} busy={pending} /> : <p className="muted">No upcoming events.</p>}

      {past.length > 0 && (
        <>
          <h2>Past</h2>
          <EventList rows={past} onDelete={remove} busy={pending} />
        </>
      )}

      {deleted.length > 0 && (
        <>
          <h2>Recently deleted</h2>
          {deleted.map((e) => (
            <div className="ev-row" key={e.id}>
              <div>
                <span className="muted">{e.name}</span>
                <div className="muted">{formatDate(e.date)}</div>
              </div>
              <button className="btn-quiet" type="button" disabled={pending} onClick={() => put(e)}>Restore</button>
            </div>
          ))}
        </>
      )}

      {undo && <Toast message={`Deleted “${undo.name}”.`} onUndo={() => put(undo)} onDone={() => setUndo(null)} />}
    </>
  );
}
