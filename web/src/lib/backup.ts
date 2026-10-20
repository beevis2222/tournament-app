import type { RoundMode } from "@starter/scoring";
import { EventSettings, type EventBundle } from "./types";

export interface BackupResult {
  bundles: EventBundle[];
  skipped: { name: string; reason: string }[];
}

// The prototype's JSON is loosely typed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const NOT_A_BACKUP = "That file isn't a backup from this app.";

export function readBackup(text: string): BackupResult {
  let data: Any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(NOT_A_BACKUP);
  }
  if (!data || data.kind !== "starter-backup" || !Array.isArray(data.events)) throw new Error(NOT_A_BACKUP);

  const result: BackupResult = { bundles: [], skipped: [] };
  for (const ev of data.events) {
    const format = ev?.event?.format;
    if (format === "scramble") result.bundles.push(importScramble(ev));
    else result.skipped.push({ name: ev?.event?.name ?? "Untitled event", reason: `${format ?? "unknown"} isn't supported yet` });
  }
  return result;
}

/** "8:00am" / "1:30pm" (or already 24-hour) -> "HH:MM"; null for anything else (a hole label like "3B"). */
function toTime24(s: string): string | null {
  const m = /^(\d{1,2}):(\d{2})\s*(am|pm)?$/i.exec(s.trim());
  if (!m) return null;
  let h = Number(m[1]);
  const ap = m[3]?.toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (h > 23 || Number(m[2]) > 59) return null;
  return String(h).padStart(2, "0") + ":" + m[2];
}

/** Prototype prizes are {on, purse, split}; when on, turn purse and split into per-place amounts. Otherwise undefined (defaults). */
function prizeAmounts(pz: Any): number[] | undefined {
  if (!pz?.on) return undefined;
  const purse = Number(pz.purse) || 0;
  const split: number[] = (Array.isArray(pz.split) ? pz.split.map(Number) : String(pz.split ?? "").split(/[^0-9.]+/).map(Number)).filter((x: number) => x > 0);
  const sum = split.reduce((a, b) => a + b, 0);
  if (purse <= 0 || !sum) return undefined;
  return split.map((x) => Math.round((purse * x * 100) / sum) / 100);
}
const defined = <T>(x: T | undefined): x is T => x !== undefined;

function importScramble(ev: Any): EventBundle {
  const e = ev.event;
  const nRounds = Math.min(4, Math.max(1, Number(e.rounds) || 1));
  const rmode = e.rmode ?? {};
  const modes: RoundMode[] = Array.from({ length: nRounds }, (_, r) => {
    const m = rmode[r] ?? rmode[String(r)] ?? "full";
    return m === "cancel" ? "called_off" : m === "front" || m === "back" ? m : "full";
  });

  const protoTeams: Any[] = ev.pairings?.teams ?? [];
  const protoRounds: Any[] = Array.isArray(ev.pairings?.rounds) ? ev.pairings.rounds : [];

  const settings = EventSettings.parse({
    holes: e.holesMode ?? "18",
    rounds: nRounds,
    teamSize: [2, 3, 4].includes(Number(e.teamSize)) ? Number(e.teamSize) : undefined,
    teamHandicap: e.scoring === "gross" ? { method: "none" } : { method: "usga" },
    limits: e.limits ?? undefined,
    flights: Number(e.flights) >= 1 ? Math.min(6, Math.trunc(Number(e.flights))) : undefined,
    start: e.start === "teetimes" ? "teetimes" : "shotgun",
    startTime: toTime24(String(e.startTime ?? "")) ?? undefined,
    interval: Number.isFinite(Number(e.interval)) && e.interval !== "" && e.interval != null ? Math.min(20, Math.max(5, Math.round(Number(e.interval)))) : undefined,
    flightNames: Array.isArray(e.flightNames) && e.flightNames.every((n: Any) => typeof n === "string") ? e.flightNames : undefined,
    prizes: prizeAmounts(e.prizes),
  });

  const teeIds = new Map<string, string>();
  const tees = (e.tees ?? []).map((t: Any) => {
    const id = crypto.randomUUID();
    teeIds.set(t.id, id);
    return {
      id,
      name: t.name,
      rating: Number(t.rating),
      slope: Number(t.slope),
      pars: t.custom && t.pars?.length === 18 ? t.pars : null,
      si: t.custom && t.si?.length === 18 ? t.si : null,
    };
  });

  const onTeam = new Set<string>(protoTeams.flatMap((t) => t.players ?? []));
  const entryIds = new Map<string, string>();
  const entries = (ev.players ?? []).map((p: Any) => {
    const id = crypto.randomUUID();
    entryIds.set(p.id, id);
    return {
      id,
      golferId: crypto.randomUUID(),
      name: p.name,
      indexUsed: Number(p.index),
      nh: !!p.nh,
      teeId: teeIds.get(p.tee) ?? null,
      alternate: !onTeam.has(p.id),
    };
  });

  const statuses = ev.pairings?.status ?? {};
  const teamIds = new Map<string, string>();
  const teams = protoTeams.map((t, sort) => {
    const id = crypto.randomUUID();
    teamIds.set(t.id, id);
    return {
      id,
      label: t.label ?? t.id,
      flight: typeof t.flight === "number" ? t.flight : null,
      status: statuses[t.id] ?? null,
      sort,
      entryIds: (t.players ?? []).map((pid: string) => entryIds.get(pid)).filter(defined),
    };
  });

  const rounds = modes.map((mode, i) => ({ id: crypto.randomUUID(), number: i + 1, mode }));

  const groups: EventBundle["groups"] = [];
  rounds.forEach((round, r) => {
    const list = protoRounds[r];
    if (!Array.isArray(list)) return;
    list.forEach((g: Any, sort: number) => {
      const start = g?.start == null ? null : String(g.start);
      const time = start ? toTime24(start) : null;
      groups.push({
        id: crypto.randomUUID(),
        roundId: round.id,
        startHole: start && !time ? start : null,
        startTime: time,
        label: g?.label ?? `Group ${sort + 1}`,
        sort,
        teamIds: (g?.teams ?? []).map((tid: string) => teamIds.get(tid)).filter(defined),
      });
    });
  });

  const scores: EventBundle["scores"] = [];
  rounds.forEach((round, r) => {
    const cards = ev.cards?.[r] ?? {};
    for (const [protoId, teamId] of teamIds) {
      const row = cards[protoId]?.team;
      if (!Array.isArray(row)) continue;
      row.forEach((v: Any, h: number) => {
        if (v === null || v === undefined || v === "") return;
        const gross = Math.trunc(Number(v));
        if (Number.isNaN(gross)) return;
        scores.push({ roundId: round.id, teamId, hole: h + 1, gross });
      });
    }
  });

  return {
    event: {
      id: crypto.randomUUID(),
      name: e.name || "Imported event",
      date: e.date || new Date().toISOString().slice(0, 10),
      status: "setup",
      settings,
    },
    course: { id: crypto.randomUUID(), name: e.course?.name ?? e.courseName ?? "Imported course", pars: e.pars, si: e.si },
    tees,
    entries,
    teams,
    rounds,
    groups,
    scores,
  };
}
