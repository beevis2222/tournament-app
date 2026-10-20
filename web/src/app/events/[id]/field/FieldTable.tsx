"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { restore, softDelete } from "@/lib/db/softDelete";
import { setEntry } from "./actions";
import type { OfferUndo } from "./FieldView";

export type FieldRow = { id: string; name: string; indexUsed: number; nh: boolean; teeId: string | null; alternate: boolean };
export type TeeOption = { id: string; name: string };

/** Shown with the engine's plus-handicap convention: -1.2 is typed and shown as +1.2. */
const show = (n: number) => (n < 0 ? `+${Math.abs(n)}` : String(n));

function parseIndexInput(v: string): number | null {
  const m = v.trim().match(/^(\+)?(-)?(\d{1,2}(?:\.\d)?)$/);
  if (!m) return null;
  const n = Number(m[3]);
  return m[1] || m[2] ? -n : n;
}

export default function FieldTable({
  entries,
  tees,
  warnings,
  offerUndo,
}: {
  entries: FieldRow[];
  tees: TeeOption[];
  warnings: Record<string, string[]>;
  offerUndo: OfferUndo;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function save(id: string, patch: { indexUsed?: number; nh?: boolean; teeId?: string | null }) {
    setError("");
    startTransition(async () => {
      const result = await setEntry(id, patch);
      if (!result.ok) setError(result.error);
      setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([k]) => k !== id)));
      router.refresh();
    });
  }

  function commitIndex(e: FieldRow) {
    const draft = drafts[e.id];
    if (draft === undefined || draft === show(e.indexUsed)) return;
    const n = parseIndexInput(draft);
    if (n === null || n < -10 || n > 54) {
      setError("Enter a handicap index like 8.4, or +1.2 for a plus handicap.");
      return;
    }
    save(e.id, { indexUsed: n });
  }

  function remove(e: FieldRow) {
    setError("");
    startTransition(async () => {
      const result = await softDelete("entries", e.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      offerUndo(`Removed ${e.name}.`, "custom", async () => {
        const back = await restore("entries", e.id);
        return { ok: !back.error, error: back.error };
      });
      router.refresh();
    });
  }

  return (
    <section>
      <h2>Players ({entries.length})</h2>
      {error && <p className="error" role="alert">{error}</p>}
      {entries.length === 0 ? (
        <p className="muted">No players yet. Import a list or add golfers from the roster.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="list">
            <thead>
              <tr><th>Name</th><th>Index</th><th>No handicap</th><th>Tee</th><th></th></tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>
                    {e.name}
                    {e.alternate && <span className="muted"> (alternate)</span>}
                    {(warnings[e.id] ?? []).map((w) => (
                      <div key={w} className="error" style={{ margin: 0, fontSize: 14 }}>{w}</div>
                    ))}
                  </td>
                  <td>
                    <input
                      aria-label={`Index for ${e.name}`}
                      style={{ width: 80 }}
                      value={drafts[e.id] ?? show(e.indexUsed)}
                      disabled={pending}
                      onChange={(ev) => setDrafts({ ...drafts, [e.id]: ev.target.value })}
                      onBlur={() => commitIndex(e)}
                      onKeyDown={(ev) => ev.key === "Enter" && ev.currentTarget.blur()}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`${e.name} has no handicap`}
                      checked={e.nh}
                      disabled={pending}
                      onChange={(ev) => save(e.id, { nh: ev.target.checked })}
                    />
                  </td>
                  <td>
                    <select
                      aria-label={`Tee for ${e.name}`}
                      value={e.teeId ?? ""}
                      disabled={pending || tees.length === 0}
                      onChange={(ev) => save(e.id, { teeId: ev.target.value || null })}
                    >
                      <option value="">{tees.length ? `First tee (${tees[0].name})` : "No tees yet"}</option>
                      {tees.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button className="btn-quiet" type="button" disabled={pending} onClick={() => remove(e)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
