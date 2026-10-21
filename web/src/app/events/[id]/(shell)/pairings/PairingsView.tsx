"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Toast } from "@/components/Toast";
import type { Problem } from "@/lib/pairings";
import { makePairings, moveTeam, sameAsRound1, setStart, undoPairings, type PairingsResult, type PairingsUndo } from "./actions";

export type TeamChip = { id: string; label: string; players: string[] };
export type GroupRow = { id: string; label: string; start: string; startValue: string; startMismatch: boolean; teams: TeamChip[] };
export type RoundRow = { number: number; groups: GroupRow[]; unplaced: TeamChip[] };

function StartInput({ value, type, disabled, onSave }: { value: string; type: "shotgun" | "teetimes"; disabled: boolean; onSave: (v: string) => void }) {
  const [text, setText] = useState(value);
  const commit = () => {
    if (text !== value) onSave(text);
  };
  return (
    <input
      aria-label="Start"
      type={type === "teetimes" ? "time" : "text"}
      value={text}
      disabled={disabled}
      size={type === "teetimes" ? undefined : 5}
      placeholder={type === "teetimes" ? undefined : "Hole"}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
      }}
    />
  );
}

export default function PairingsView({
  eventId,
  startType,
  teamCount,
  preview,
  rounds,
  problems,
}: {
  eventId: string;
  startType: "shotgun" | "teetimes";
  teamCount: number;
  preview: string[];
  rounds: RoundRow[];
  problems: Problem[];
}) {
  const router = useRouter();
  const [roundNo, setRoundNo] = useState(1);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [undo, setUndo] = useState<{ message: string; data: PairingsUndo } | null>(null);
  const [pending, startTransition] = useTransition();

  const round = rounds.find((r) => r.number === roundNo) ?? rounds[0];
  const errors = problems.filter((p) => p.level === "error");
  const warnings = problems.filter((p) => p.level === "warning");

  function after(result: PairingsResult, message: string) {
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setUndo({ message, data: result.undo });
    router.refresh();
  }

  function make() {
    setError("");
    startTransition(async () => {
      const r = await makePairings(eventId, round.number);
      after(r, r.ok ? `Made ${r.groups} groups for round ${round.number}.` : "");
    });
  }

  function same() {
    setError("");
    startTransition(async () => {
      const r = await sameAsRound1(eventId, round.number);
      after(r, r.ok ? `Round ${round.number} now matches round 1.` : "");
    });
  }

  function runUndo() {
    const u = undo;
    setUndo(null);
    if (!u) return;
    startTransition(async () => {
      const r = await undoPairings(eventId, u.data);
      setError(r.ok ? "" : r.error);
      router.refresh();
    });
  }

  function move(teamId: string, groupId: string) {
    setError("");
    startTransition(async () => {
      const r = await moveTeam(teamId, groupId);
      if (!r.ok) setError(r.error);
      router.refresh();
    });
  }

  function start(groupId: string, value: string) {
    setError("");
    startTransition(async () => {
      const r = await setStart(groupId, value);
      if (!r.ok) setError(r.error);
      router.refresh();
    });
  }

  const moveSelect = (t: TeamChip, current: string) => (
    <select aria-label={`Move ${t.label}`} value={current} disabled={pending} onChange={(e) => move(t.id, e.target.value)}>
      {current === "" && <option value="">Move to…</option>}
      {round.groups.map((g) => (
        <option key={g.id} value={g.id}>
          {g.label} ({g.start})
        </option>
      ))}
    </select>
  );

  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}

      <div className="row row-gap">
        {rounds.length > 1 && (
          <select aria-label="Round" value={round.number} onChange={(e) => setRoundNo(Number(e.target.value))}>
            {rounds.map((r) => (
              <option key={r.number} value={r.number}>Round {r.number}</option>
            ))}
          </select>
        )}
        <button className="btn" type="button" disabled={pending || teamCount === 0} onClick={make}>
          {round.groups.length ? "Make pairings again" : "Make pairings"}
        </button>
        {round.number > 1 && (
          <button className="btn-quiet" type="button" disabled={pending || (rounds[0]?.groups.length ?? 0) === 0} onClick={same}>
            Same as round 1
          </button>
        )}
        <button className="btn-quiet" type="button" disabled={pending || round.groups.length === 0} onClick={() => setEditing((v) => !v)}>
          {editing ? "Done editing" : "Edit"}
        </button>
      </div>
      <p className="muted">
        {teamCount === 0
          ? "Make teams first, then come back to pair them."
          : `Each team gets its own group in random order, starting ${preview.join(", ")}${teamCount > preview.length ? "…" : ""}. Making pairings replaces this round's groups (Undo brings them back).`}
      </p>

      {round.groups.length === 0 ? (
        <p className="muted">No pairings for round {round.number} yet.</p>
      ) : (
        <div className="tpl-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>
          {round.groups.map((g) => (
            <div key={g.id} className="tee-card" style={{ margin: 0 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong style={{ fontFamily: "var(--display)", fontSize: 20 }}>{g.label}</strong>
                {editing && !g.startMismatch ? (
                  <StartInput key={`${g.id}:${g.startValue}`} value={g.startValue} type={startType} disabled={pending} onSave={(v) => start(g.id, v)} />
                ) : (
                  <strong>{g.start}</strong>
                )}
              </div>
              {editing && g.startMismatch && <p className="muted" style={{ margin: "4px 0" }}>Start type changed. Make pairings again.</p>}
              {g.teams.length === 0 && <p className="muted" style={{ margin: "6px 0" }}>Empty</p>}
              {g.teams.map((t) => (
                <div key={t.id} style={{ padding: "6px 0" }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span>{t.label}</span>
                    {editing && moveSelect(t, g.id)}
                  </div>
                  <div className="muted">{t.players.join(", ")}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {round.unplaced.length > 0 && round.groups.length > 0 && (
        <>
          <h3>Not in a group</h3>
          {round.unplaced.map((t) => (
            <div key={t.id} className="row" style={{ padding: "4px 0" }}>
              <span>
                {t.label} <span className="muted">{t.players.join(", ")}</span>
              </span>
              {moveSelect(t, "")}
            </div>
          ))}
        </>
      )}

      <h3>Pre-event check</h3>
      {problems.length === 0 ? (
        <p className="ok" role="status">Ready to play</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {errors.map((p, i) => (
            <li key={`e${i}`} className="error" style={{ margin: "0 0 6px" }}>
              {p.text}
              {p.code === "no-course" && <> <Link href={`/events/${eventId}/course`}>Choose a course</Link></>}
            </li>
          ))}
          {warnings.map((p, i) => (
            <li key={`w${i}`} style={{ margin: "0 0 6px", borderLeft: "4px solid var(--flag)", paddingLeft: 8 }}>
              {p.text}
            </li>
          ))}
        </ul>
      )}

      {undo && <Toast message={undo.message} onUndo={runUndo} onDone={() => setUndo(null)} />}
    </>
  );
}
