// Converts an event from the prototype's backup file (kind "starter-backup")
// into the engine's shapes. Used by the parity tests and, later, to import
// events built in the prototype.

import type { RoundMode, ScrambleEvent, TeamCards } from "./types.ts";

// The prototype JSON is loosely typed; see docs/data-model in the skill.
type Any = any;

export function fromPrototypeScramble(ev: Any): ScrambleEvent {
  const e = ev.event;
  const nRounds = Math.min(4, Math.max(1, Number(e.rounds) || 1));
  const rmode = e.rmode ?? {};
  const rounds: RoundMode[] = Array.from({ length: nRounds }, (_, r) => {
    const m = rmode[r] ?? rmode[String(r)] ?? "full";
    return m === "cancel" ? "called_off" : m === "front" || m === "back" ? m : "full";
  });
  const statuses = ev.pairings?.status ?? {};
  return {
    teamHandicap: e.scoring === "gross" ? { method: "none" } : { method: "usga" },
    course: {
      pars: e.pars,
      si: e.si,
      tees: e.tees.map((t: Any) => ({
        id: t.id,
        name: t.name,
        rating: Number(t.rating),
        slope: Number(t.slope),
        ...(t.custom && t.pars?.length === 18 ? { pars: t.pars } : {}),
        ...(t.custom && t.si?.length === 18 ? { si: t.si } : {}),
      })),
    },
    players: ev.players.map((p: Any) => ({ id: p.id, name: p.name, index: Number(p.index), nh: !!p.nh, teeId: p.tee })),
    teams: (ev.pairings?.teams ?? []).map((t: Any) => ({
      id: t.id,
      name: t.label ?? t.id,
      playerIds: t.players,
      flight: t.flight,
      ...(statuses[t.id] ? { status: statuses[t.id] } : {}),
    })),
    holes: e.holesMode ?? "18",
    rounds,
    limits: e.limits ?? undefined,
    scores: rounds.map((_, r) => {
      const cards: TeamCards = {};
      const round = ev.cards?.[r] ?? {};
      for (const tid of Object.keys(round)) {
        const row = round[tid]?.team;
        if (row) cards[tid] = row.map((v: Any) => (v === null || v === undefined || v === "" ? null : Math.trunc(Number(v))));
      }
      return cards;
    }),
  };
}
