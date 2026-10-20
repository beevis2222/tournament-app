import { fmtTime } from "@/lib/pairings";
import type { EventBundle } from "@/lib/types";

export type Step = { key: string; label: string; href: string; done: boolean };

function scoresAllIn(b: EventBundle): boolean {
  const perRound = b.event.settings.holes === "18" ? 18 : 9;
  const playing = b.teams.filter((t) => !t.status);
  const live = b.rounds.filter((r) => r.mode !== "called_off");
  if (!playing.length || !live.length) return false;
  return live.every((r) =>
    playing.every((t) => b.scores.filter((s) => s.roundId === r.id && s.teamId === t.id && s.gross !== null).length >= perRound),
  );
}

/** The progress bar: Details, Field, Teams, Pairings, Scores, Finish. */
export function progressSteps(b: EventBundle): Step[] {
  const base = `/events/${b.event.id}`;
  const players = b.entries.filter((e) => !e.alternate).length;
  return [
    { key: "details", label: "Details", href: `${base}/details`, done: b.course.id !== "" && b.event.name.trim() !== "" },
    { key: "field", label: players ? `Field, ${players}` : "Field", href: `${base}/field`, done: players >= 2 },
    { key: "teams", label: "Teams", href: `${base}/teams`, done: b.teams.length > 0 },
    { key: "pairings", label: "Pairings", href: `${base}/pairings`, done: b.groups.length > 0 },
    { key: "scores", label: "Scores", href: `${base}/cards`, done: scoresAllIn(b) },
    { key: "finish", label: "Finish", href: `${base}/finish`, done: b.event.status === "final" },
  ];
}

/** One line under the event name, like the prototype's. */
export function eventSubtitle(b: EventBundle): string {
  const s = b.event.settings;
  const per = s.holes === "18" ? 18 : 9;
  const parts: string[] = [];
  parts.push(s.rounds > 1 ? `${s.rounds * per}-hole` : per === 9 ? `9-hole (${s.holes} nine)` : "");
  parts.push(`${s.teamSize}-person ${s.teamHandicap.method === "none" ? "gross " : ""}scramble`);
  if (s.flights > 1) parts.push(`${s.flights} flights`);
  parts.push(s.start === "shotgun" ? `shotgun at ${fmtTime(s.startTime)}` : `tee times from ${fmtTime(s.startTime)}`);
  const text = parts.filter(Boolean);
  const first = text.length > 1 && /-hole/.test(text[0]) ? `${text[0]} ${text[1]}` : text[0];
  const rest = text.slice(/-hole/.test(text[0]) ? 2 : 1);
  return [first, ...rest].join(", ");
}
