"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Toast } from "@/components/Toast";
import { clearTeams, makeTeams, moveEntry, setFlights, setTeamStatus, undoTeams, type TeamsResult, type TeamsUndo } from "./actions";

export type PlayerRow = { id: string; name: string; index: number; nh: boolean };
export type TeamRow = {
  id: string;
  label: string;
  status: "WD" | "DQ" | "NS" | null;
  handicap: number | null;
  flight: string | null;
  players: PlayerRow[];
};

const showIndex = (p: PlayerRow) => (p.nh ? "NH" : p.index < 0 ? `+${Math.abs(p.index)}` : String(p.index));

export default function TeamsView({
  eventId,
  teamMode,
  teamSize,
  flights,
  hasCourse,
  fieldCount,
  teams,
  alternates,
  unassigned,
}: {
  eventId: string;
  teamMode: "listed" | "balanced";
  teamSize: number;
  flights: number;
  hasCourse: boolean;
  fieldCount: number;
  teams: TeamRow[];
  alternates: PlayerRow[];
  unassigned: PlayerRow[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [undo, setUndo] = useState<{ message: string; data: TeamsUndo } | null>(null);
  const [pending, startTransition] = useTransition();

  const courseLink = <Link href={`/events/${eventId}/course`}>Choose a course first</Link>;

  function after(result: TeamsResult, message: string) {
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setUndo({ message, data: result.undo });
    router.refresh();
  }

  function make(mode: "listed" | "balanced") {
    setError("");
    setInfo("");
    startTransition(async () => {
      const result = await makeTeams(eventId, mode);
      after(result, result.ok ? `Made ${result.teams} teams${result.alternates ? ` and ${result.alternates} alternates` : ""}.` : "");
    });
  }

  function clear() {
    setError("");
    setInfo("");
    startTransition(async () => after(await clearTeams(eventId), "Teams cleared."));
  }

  function runUndo() {
    const u = undo;
    setUndo(null);
    if (!u) return;
    startTransition(async () => {
      const result = await undoTeams(eventId, u.data);
      setError(result.ok ? "" : result.error);
      router.refresh();
    });
  }

  function move(entryId: string, to: string) {
    setError("");
    startTransition(async () => {
      const result = await moveEntry(entryId, to === "alternates" ? null : to);
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  }

  function split() {
    setError("");
    setInfo("");
    startTransition(async () => {
      const result = await setFlights(eventId);
      if (!result.ok) setError(result.error);
      else setInfo(`Split into ${result.flights} ${result.flights === 1 ? "flight" : "flights"}.`);
      router.refresh();
    });
  }

  function status(teamId: string, value: string) {
    setError("");
    startTransition(async () => {
      const result = await setTeamStatus(teamId, value === "" ? null : (value as "WD" | "DQ" | "NS"));
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  }

  const moveSelect = (p: PlayerRow, current: string) => (
    <select aria-label={`Move ${p.name}`} value={current} disabled={pending} onChange={(e) => move(p.id, e.target.value)}>
      {current === "" && <option value="">Move to…</option>}
      {teams.map((t) => (
        <option key={t.id} value={t.id}>{t.label}</option>
      ))}
      <option value="alternates">Alternates</option>
    </select>
  );

  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      {info && <p className="ok" role="status">{info}</p>}

      <div className="row row-gap">
        <button className="btn" type="button" disabled={pending || fieldCount === 0} onClick={() => make("balanced")}>
          Make balanced teams
        </button>
        <button className="btn-quiet" type="button" disabled={pending || fieldCount === 0} onClick={() => make("listed")}>
          Make teams in listed order
        </button>
        <button className="btn-quiet" type="button" disabled={pending || teams.length === 0} onClick={clear}>
          Clear teams
        </button>
        {hasCourse && flights > 1 && (
          <button className="btn-quiet" type="button" disabled={pending || teams.length === 0} onClick={split}>
            Split into flights
          </button>
        )}
      </div>
      <p className="muted">
        This event is set up for {teamMode === "balanced" ? "balanced teams" : "teams as signed up"} of {teamSize}. Making teams uses everyone in the
        field and replaces the teams below (Undo brings them back).
        {fieldCount === 0 && " Add players on the Field screen first."}
      </p>
      {!hasCourse && (
        <p className="note">{courseLink} so team handicaps and flights can be worked out.</p>
      )}
      {hasCourse && flights === 1 && teams.length > 0 && (
        <p className="muted">One flight. Set more flights on the Details screen to split the teams.</p>
      )}

      {teams.length === 0 ? (
        <p className="muted">No teams yet.</p>
      ) : (
        <div className="tpl-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))" }}>
          {teams.map((t) => (
            <div key={t.id} className="tee-card" style={{ margin: 0 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong style={{ fontFamily: "var(--display)", fontSize: 20 }}>{t.label}</strong>
                <select
                  aria-label={`Status for ${t.label}`}
                  value={t.status ?? ""}
                  disabled={pending}
                  onChange={(e) => status(t.id, e.target.value)}
                >
                  <option value="">Playing</option>
                  <option value="WD">WD</option>
                  <option value="DQ">DQ</option>
                  <option value="NS">NS</option>
                </select>
              </div>
              <div className="muted">
                {hasCourse ? (
                  <>Team handicap {t.handicap ?? 0}</>
                ) : (
                  courseLink
                )}
                {t.flight && ` · ${t.flight}`}
                {t.players.length < teamSize && <span className="error"> · Short: {t.players.length} of {teamSize}</span>}
              </div>
              {t.players.map((p) => (
                <div key={p.id} className="row" style={{ justifyContent: "space-between", padding: "4px 0" }}>
                  <span>{p.name} <span className="muted">{showIndex(p)}</span></span>
                  {moveSelect(p, t.id)}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {unassigned.length > 0 && (
        <>
          <h3>Not on a team</h3>
          {unassigned.map((p) => (
            <div key={p.id} className="row" style={{ padding: "4px 0" }}>
              <span>{p.name} <span className="muted">{showIndex(p)}</span></span>
              {moveSelect(p, "")}
            </div>
          ))}
        </>
      )}

      {alternates.length > 0 && (
        <>
          <h3>Alternates</h3>
          {alternates.map((p) => (
            <div key={p.id} className="row" style={{ padding: "4px 0" }}>
              <span>{p.name} <span className="muted">{showIndex(p)}</span></span>
              {moveSelect(p, "")}
            </div>
          ))}
        </>
      )}

      {undo && <Toast message={undo.message} onUndo={runUndo} onDone={() => setUndo(null)} />}
    </>
  );
}
