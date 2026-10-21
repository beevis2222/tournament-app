"use client";

import { useEffect, useRef, useState } from "react";
import { holesInPlay, scrambleRound, strokesOnHole, type RoundMode, type ScrambleEvent, type Status } from "@starter/scoring";
import HoleGrid from "@/components/HoleGrid";
import { BAD_SCORE, liveEvent, newHoleSync, parseGross, saveFinished, sumHoles, wantValue, type HoleSync } from "@/lib/cardEntry";
import { saveScore, setRoundMode, setTeamStatus } from "./actions";

type Card = { text: string[]; value: (number | null)[]; saved: (number | null)[] };

const MODES: { value: RoundMode; label: string }[] = [
  { value: "full", label: "Full" },
  { value: "front", label: "Front 9 only" },
  { value: "back", label: "Back 9 only" },
  { value: "called_off", label: "Called off" },
];
const STATUSES: { value: Status | ""; label: string }[] = [
  { value: "", label: "Playing" },
  { value: "WD", label: "WD" },
  { value: "DQ", label: "DQ" },
  { value: "NS", label: "No show" },
];

const emptyCard = (): (number | null)[] => Array(18).fill(null);

export default function CardsView({
  eventId,
  ev,
  rounds,
  teamIds,
}: {
  eventId: string;
  ev: ScrambleEvent;
  rounds: { id: string; number: number }[];
  teamIds: string[];
}) {
  const teams = ev.teams.filter((t) => teamIds.includes(t.id));
  const [roundIdx, setRoundIdx] = useState(0);
  const [teamId, setTeamId] = useState(teams[0].id);
  const [modes, setModes] = useState<RoundMode[]>(ev.rounds);
  const [statuses, setStatuses] = useState<Record<string, Status | undefined>>(() =>
    Object.fromEntries(ev.teams.map((t) => [t.id, t.status])),
  );
  const [cards, setCards] = useState<Record<string, Card>>(() => {
    const out: Record<string, Card> = {};
    ev.scores.forEach((round, r) => {
      for (const t of ev.teams) {
        const v = round[t.id] ?? emptyCard();
        out[`${r}:${t.id}`] = { text: v.map((g) => (g === null || g === undefined ? "" : String(g))), value: [...v], saved: [...v] };
      }
    });
    return out;
  });
  const [errors, setErrors] = useState<Record<string, string>>({}); // bad numbers, by "r:team:hole"
  const [failed, setFailed] = useState<Record<string, string>>({}); // failed saves
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false); // a round mode or team status change is in flight
  const [pending, setPending] = useState<Record<string, string>>({}); // saves in flight, by "r:team:hole"
  const latest = useRef(cards);
  latest.current = cards;
  const sync = useRef<Record<string, HoleSync>>({}); // per hole: what the database holds, what was typed last, whether a save is in flight

  const pendingCount = Object.keys(pending).length;
  const failedCount = Object.keys(failed).length;
  const unsaved = pendingCount + failedCount > 0;
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  const cardOf = (r: number, t: string): Card => cards[`${r}:${t}`] ?? { text: Array(18).fill(""), value: emptyCard(), saved: emptyCard() };
  const live = liveEvent(ev, modes, Object.fromEntries(Object.entries(cards).map(([k, c]) => [k, c.value])));
  const team = teams.find((t) => t.id === teamId) ?? teams[0];
  const key = `${roundIdx}:${team.id}`;
  const round = rounds[roundIdx];

  const holes = holesInPlay(live.holes, live.rounds[roundIdx]);
  const result = scrambleRound(live, team, roundIdx);
  const value = cardOf(roundIdx, team.id).value;
  const strokes = Array.from({ length: 18 }, (_, h) => strokesOnHole(result.handicap, h, holes, live.course.si));
  // Out / In: plain sums of what is entered on those holes; "–" until one is entered.
  const sumOf = (list: number[]) => (list.length && list.some((h) => value[h] !== null) ? sumHoles(value, list) : null);

  const pick = <T,>(rec: Record<string, T>): Record<number, T> => {
    const out: Record<number, T> = {};
    for (const [k, v] of Object.entries(rec)) if (k.startsWith(`${key}:`)) out[Number(k.slice(key.length + 1))] = v;
    return out;
  };
  const without = (rec: Record<string, string>, k: string) => {
    const { [k]: _gone, ...rest } = rec;
    void _gone;
    return rest;
  };

  function change(h: number, text: string) {
    const p = parseGross(text);
    setCards((all) => {
      const c = all[key] ?? cardOf(roundIdx, team.id);
      const next: Card = { ...c, text: c.text.map((t, i) => (i === h ? text : t)), value: [...c.value] };
      if (p.kind === "empty") next.value[h] = null;
      else if (p.kind === "value") next.value[h] = p.value;
      return { ...all, [key]: next };
    });
    setErrors((e) => without(e, `${key}:${h}`));
  }

  async function commit(h: number) {
    const k = `${key}:${h}`;
    const c = latest.current[key];
    if (!c) return;
    const p = parseGross(c.text[h]);
    if (p.kind === "invalid") {
      setErrors((e) => ({ ...e, [k]: BAD_SCORE }));
      return;
    }
    const v = p.kind === "empty" ? null : p.value;
    const state = sync.current[k] ?? newHoleSync(c.saved[h]);
    const step = wantValue(state, v);
    sync.current[k] = step.state;
    if (!step.send) {
      if (!step.state.sending) setFailed((f) => without(f, k));
      return;
    }
    await flush(k, key, round.id, team.id, h, step.send.value);
  }

  /** Sends one value; when it lands, sends the latest typed value if that changed meanwhile. */
  async function flush(k: string, cardKey: string, roundId: string, teamKey: string, h: number, first: number | null) {
    let next: { value: number | null } | null = { value: first };
    while (next) {
      const sent: number | null = next.value;
      setPending((p) => ({ ...p, [k]: "1" }));
      // A dropped connection makes the action throw instead of returning an error.
      const r = await saveScore(roundId, teamKey, h + 1, sent).catch(() => ({ ok: false as const, error: "Check your connection and try again." }));
      const step = saveFinished(sync.current[k], sent, r.ok);
      sync.current[k] = step.state;
      if (r.ok) {
        setCards((all) => {
          const cur = all[cardKey];
          return { ...all, [cardKey]: { ...cur, saved: cur.saved.map((s, i) => (i === h ? sent : s)) } };
        });
        setFailed((f) => without(f, k));
      } else {
        setFailed((f) => ({ ...f, [k]: `Not saved. ${r.error}` }));
      }
      next = step.send;
      if (!next) setPending((p) => without(p, k));
    }
  }

  async function changeMode(mode: RoundMode) {
    if (busy) return;
    setBusy(true);
    const before = modes[roundIdx];
    setMessage("");
    setModes((m) => m.map((x, i) => (i === roundIdx ? mode : x)));
    const r = await setRoundMode(eventId, round.id, mode).catch(() => ({ ok: false as const, error: "Check your connection and try again." }));
    if (!r.ok) {
      setModes((m) => m.map((x, i) => (i === roundIdx ? before : x)));
      setMessage(r.error);
    }
    setBusy(false);
  }

  async function changeStatus(status: Status | "") {
    if (busy) return;
    setBusy(true);
    const before = statuses[team.id];
    setMessage("");
    setStatuses((s) => ({ ...s, [team.id]: status || undefined }));
    const r = await setTeamStatus(eventId, team.id, status || null).catch(() => ({ ok: false as const, error: "Check your connection and try again." }));
    if (!r.ok) {
      setStatuses((s) => ({ ...s, [team.id]: before }));
      setMessage(r.error);
    }
    setBusy(false);
  }

  const status = statuses[team.id];
  const statusLabel = (t: string) => (t === "NS" ? "No show" : t);

  return (
    <div>
      {rounds.length > 1 && (
        <div className="row row-gap" role="tablist" aria-label="Round" style={{ marginBottom: 12 }}>
          {rounds.map((r, i) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={i === roundIdx}
              className={i === roundIdx ? "btn" : "btn-quiet"}
              onClick={() => setRoundIdx(i)}
            >
              Round {r.number}
            </button>
          ))}
        </div>
      )}

      <p className="muted" role="status" aria-live="polite" style={{ margin: "0 0 10px" }} data-testid="save-status">
        {pendingCount > 0 ? "Saving…" : failedCount > 0 ? `${failedCount} not saved` : "All saved"}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(200px, 260px) 1fr", gap: 20, alignItems: "start" }}>
        <ul className="team-pick" aria-label="Teams" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {teams.map((t) => {
            const thru = scrambleRound(live, t, roundIdx).thru;
            const st = statuses[t.id];
            const hasUnsaved = [...Object.keys(pending), ...Object.keys(failed)].some((k2) => k2.split(":")[1] === t.id);
            return (
              <li key={t.id}>
                <button
                  type="button"
                  className={t.id === team.id ? "btn" : "btn-quiet"}
                  aria-current={t.id === team.id}
                  onClick={() => setTeamId(t.id)}
                  style={{ width: "100%", textAlign: "left", marginBottom: 6, display: "flex", justifyContent: "space-between", gap: 8 }}
                >
                  <span>{t.name}{st ? ` (${statusLabel(st)})` : ""}</span>
                  <span>{hasUnsaved ? "● not saved · " : ""}thru {thru}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="card" style={{ minWidth: 0 }}>
          <div className="row row-gap" style={{ justifyContent: "space-between", alignItems: "end", flexWrap: "wrap" }}>
            <div>
              <strong style={{ fontFamily: "var(--display)", fontSize: 20 }}>{team.name}</strong>
              <div className="muted">
                Team handicap {result.handicap} · Gross {result.thru ? result.gross : "–"} · Net {result.thru ? result.net : "–"} · thru {result.thru}
              </div>
            </div>
            <div className="row row-gap">
              <label>
                Round{" "}
                <select aria-label="Round mode" disabled={busy} value={modes[roundIdx]} onChange={(e) => changeMode(e.target.value as RoundMode)}>
                  {MODES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Team{" "}
                <select aria-label="Team status" disabled={busy} value={status ?? ""} onChange={(e) => changeStatus(e.target.value as Status | "")}>
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <p className="muted" style={{ margin: "6px 0 14px" }}>Scores already entered are kept.</p>
          {message && <p className="error" role="alert">{message}</p>}

          {holes.length === 0 ? (
            <p className="note">This round is called off. Pick another mode to enter scores.</p>
          ) : (
            <HoleGrid
              holes={holes}
              pars={ev.course.pars}
              strokes={strokes}
              texts={cardOf(roundIdx, team.id).text}
              errors={pick(errors)}
              failed={pick(failed)}
              out={sumOf(holes.filter((h) => h < 9))}
              inn={sumOf(holes.filter((h) => h >= 9))}
              total={result.thru ? result.gross : null}
              onChange={change}
              onBlur={(h) => void commit(h)}
              onRetry={(h) => void commit(h)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
