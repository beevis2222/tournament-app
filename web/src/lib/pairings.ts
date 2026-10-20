import type { EventBundle, EventSettings } from "./types";

export interface DraftGroup {
  teamIds: string[];
  startHole: string | null;
  startTime: string | null;
}
export interface Problem {
  level: "error" | "warning";
  text: string;
}

type StartSettings = Pick<EventSettings, "start" | "startTime" | "interval">;

/** "13:05" -> "1:05 pm", "00:10" -> "12:10 am". */
export function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`;
}

/** Start for group i of total: a hole for shotgun, an "HH:MM" time for tee times. */
function startFor(i: number, total: number, s: StartSettings): { startHole: string | null; startTime: string | null } {
  if (s.start === "shotgun") {
    const hole = (i % 18) + 1;
    return { startHole: total > 18 ? `${hole}${i < 18 ? "A" : "B"}` : String(hole), startTime: null };
  }
  const [h, m] = s.startTime.split(":").map(Number);
  const t = h * 60 + m + i * s.interval;
  const hh = String(Math.floor(t / 60) % 24).padStart(2, "0");
  return { startHole: null, startTime: `${hh}:${String(t % 60).padStart(2, "0")}` };
}

function display(st: { startHole: string | null; startTime: string | null }): string {
  return st.startHole ?? (st.startTime ? fmtTime(st.startTime) : "");
}

export function startLabel(i: number, total: number, s: StartSettings): string {
  return display(startFor(i, total, s));
}

/** Scramble: one team per group, shuffled (Fisher-Yates), then given starts in order. */
export function buildGroups(teamIds: string[], s: StartSettings, rand: () => number = Math.random): DraftGroup[] {
  const order = [...teamIds];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order.map((id, i) => ({ teamIds: [id], ...startFor(i, order.length, s) }));
}

export function preEventCheck(b: EventBundle): Problem[] {
  const out: Problem[] = [];
  const { teamSize } = b.event.settings;

  for (const e of b.entries) if (e.nh) out.push({ level: "warning", text: `${e.name} has no handicap index.` });

  const entryById = new Map(b.entries.map((e) => [e.id, e]));
  for (const t of b.teams) {
    const n = t.entryIds.filter((id) => !entryById.get(id)?.alternate).length;
    if (n < teamSize) out.push({ level: "warning", text: `${t.label} has only ${n} players.` });
  }

  for (const r of b.rounds) {
    const groups = b.groups.filter((g) => g.roundId === r.id);
    const started = new Set<string>();
    const seen = new Set<string>();
    const dup = new Set<string>();
    for (const g of groups) {
      if (!g.startHole && !g.startTime) continue;
      for (const id of g.teamIds) started.add(id);
      const label = display(g);
      if (seen.has(label)) dup.add(label);
      seen.add(label);
    }
    for (const t of b.teams) {
      if (!started.has(t.id)) out.push({ level: "error", text: `${t.label} has no starting hole or time.` });
    }
    for (const label of dup) out.push({ level: "error", text: `Two groups start at ${label} in round ${r.number}.` });
  }

  if (b.course.pars.length !== 18 || b.course.pars.some((p) => typeof p !== "number")) {
    out.push({ level: "error", text: "No course pars set." });
  }
  return out;
}
