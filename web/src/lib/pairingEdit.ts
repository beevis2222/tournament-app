import type { EventSettings } from "./types";

const HOLE = /^(1[0-8]|[1-9])[A-Za-z]?$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export type StartPatch = { start_hole: string | null; start_time: string | null };

/** Checks a typed start: a hole label ("1", "10A") for shotgun, "HH:MM" (24 hour) for tee times. */
export function checkStart(type: EventSettings["start"], input: string): { ok: true; patch: StartPatch } | { ok: false; error: string } {
  const text = input.trim();
  if (type === "shotgun") {
    if (!HOLE.test(text)) return { ok: false, error: "Type a hole from 1 to 18, like 7 or 10A." };
    return { ok: true, patch: { start_hole: text.toUpperCase(), start_time: null } };
  }
  if (!TIME.test(text)) return { ok: false, error: "Pick a start time." };
  return { ok: true, patch: { start_hole: null, start_time: text } };
}

/**
 * Moving a team within a round. `current` = the round's live groups the team is linked to now.
 * Whatever happens, the team ends in exactly one live group of the round (the target).
 */
export type MovePlan = { kind: "none" } | { kind: "update"; from: string } | { kind: "insert" } | { kind: "error"; error: string };
export function planMove(current: string[], toGroupId: string): MovePlan {
  if (current.length > 1) return { kind: "error", error: "That team is in more than one group. Make pairings again." };
  if (current[0] === toGroupId) return { kind: "none" };
  return current.length ? { kind: "update", from: current[0] } : { kind: "insert" };
}

/** Does a stored start match the event's start type? (It stops matching if the type is changed later.) */
export function startMatchesType(type: EventSettings["start"], g: { startHole: string | null; startTime: string | null }): boolean {
  return type === "shotgun" ? g.startTime === null : g.startHole === null;
}
