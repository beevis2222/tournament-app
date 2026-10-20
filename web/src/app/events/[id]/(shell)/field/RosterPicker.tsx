"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addFromRoster } from "./actions";
import type { OfferUndo } from "./FieldView";

export type RosterRow = { id: string; name: string; index: number | null; nh: boolean };

export default function RosterPicker({ eventId, roster, offerUndo }: { eventId: string; roster: RosterRow[]; offerUndo: OfferUndo }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const shown = roster.filter((g) => g.name.toLowerCase().includes(filter.trim().toLowerCase()));

  function add() {
    setError("");
    startTransition(async () => {
      const result = await addFromRoster(eventId, [...picked]);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPicked(new Set());
      offerUndo(`Added ${result.added} ${result.added === 1 ? "player" : "players"} from the roster.`, "field", result.undo);
      router.refresh();
    });
  }

  return (
    <details className="card row-gap">
      <summary>Add from roster ({roster.length} golfers not in this field)</summary>
      {roster.length === 0 ? (
        <p className="muted">Everyone on the club roster is already in this field. Imported players are added to the roster.</p>
      ) : (
        <>
          <label className="field" style={{ marginTop: 12 }}>
            <span>Find a golfer</span>
            <input value={filter} onChange={(e) => setFilter(e.target.value)} />
          </label>
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {shown.map((g) => (
              <label key={g.id} className="row" style={{ padding: "4px 0" }}>
                <input
                  type="checkbox"
                  checked={picked.has(g.id)}
                  onChange={(e) => {
                    const next = new Set(picked);
                    if (e.target.checked) next.add(g.id);
                    else next.delete(g.id);
                    setPicked(next);
                  }}
                />
                <span>{g.name}</span>
                <span className="muted">{g.nh || g.index === null ? "NH" : g.index < 0 ? `+${Math.abs(g.index)}` : g.index}</span>
              </label>
            ))}
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn" type="button" disabled={pending || !picked.size} onClick={add} style={{ marginTop: 12 }}>
            Add {picked.size || ""} to field
          </button>
        </>
      )}
    </details>
  );
}
