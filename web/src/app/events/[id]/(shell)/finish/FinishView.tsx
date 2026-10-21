"use client";

import { useState, useTransition } from "react";
import { Toast } from "@/components/Toast";
import { reopenEvent, setEventStatus, type EventStatus } from "./actions";

export default function FinishView({ eventId, status, csvName }: { eventId: string; status: EventStatus; csvName: string }) {
  const [error, setError] = useState("");
  const [undo, setUndo] = useState<{ message: string; back: EventStatus } | null>(null);
  const [pending, startTransition] = useTransition();

  const change = (next: EventStatus, remember: boolean) =>
    startTransition(async () => {
      setError("");
      const res = await setEventStatus(eventId, next);
      if (!res.ok) return setError(res.error);
      setUndo(remember ? { message: "Event marked final.", back: res.previous } : null);
    });

  const reopen = () =>
    startTransition(async () => {
      setError("");
      const res = await reopenEvent(eventId);
      if (!res.ok) return setError(res.error);
      setUndo({ message: "Event reopened.", back: res.previous });
    });

  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      <p>
        {status === "final" ? (
          <>
            <strong>This event is final.</strong>{" "}
            <button type="button" className="btn-quiet" disabled={pending} onClick={reopen}>
              Reopen event
            </button>
          </>
        ) : (
          <button type="button" className="btn" disabled={pending} onClick={() => change("final", true)}>
            Mark event final
          </button>
        )}{" "}
        <a className="btn-quiet" href={`/events/${eventId}/finish/csv`} download={csvName} style={{ textDecoration: "none", display: "inline-block" }}>
          Download CSV
        </a>
      </p>
      {undo !== null && <Toast message={undo.message} onUndo={() => change(undo.back, false)} onDone={() => setUndo(null)} />}
    </>
  );
}
