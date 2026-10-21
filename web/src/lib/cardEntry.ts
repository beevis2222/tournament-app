import type { RoundMode, ScrambleEvent } from "@starter/scoring";

export type Gross = { kind: "empty" } | { kind: "value"; value: number } | { kind: "invalid" };

export const BAD_SCORE = "Enter a number from 1 to 20.";

/** What was typed in a hole box: blank clears the hole, 1-20 is a score, anything else is rejected. */
export function parseGross(text: string): Gross {
  const t = text.trim();
  if (t === "") return { kind: "empty" };
  if (!/^\d{1,3}$/.test(t)) return { kind: "invalid" };
  const n = Number(t);
  return n >= 1 && n <= 20 ? { kind: "value", value: n } : { kind: "invalid" };
}

/**
 * The event as the engine should see it right now: round modes and the cards being edited on
 * screen laid over the loaded event. `cards` is keyed "roundIndex:teamId" with 18 holes each.
 */
export function liveEvent(base: ScrambleEvent, modes: RoundMode[], cards: Record<string, (number | null)[]>): ScrambleEvent {
  const scores = base.scores.map((round, r) => {
    const out = { ...round };
    for (const team of base.teams) {
      const card = cards[`${r}:${team.id}`];
      if (card) out[team.id] = card;
    }
    return out;
  });
  return { ...base, rounds: modes, scores };
}

/** Display sum of the scores entered on the given holes (0-based). Not a golf total; totals come from the engine. */
export function sumHoles(card: (number | null)[], holes: number[]): number {
  return holes.reduce((a, h) => a + (card[h] ?? 0), 0);
}

/**
 * Save bookkeeping for one hole box. `confirmed` is what the database is known to hold,
 * `desired` is the latest value typed, `sending` is true while a save is in flight.
 * At most one save per hole is in flight; when it finishes, the latest typed value is sent if it differs.
 */
export type HoleSync = { confirmed: number | null; desired: number | null; sending: boolean };
export type SyncStep = { state: HoleSync; send: { value: number | null } | null };

export const newHoleSync = (confirmed: number | null): HoleSync => ({ confirmed, desired: confirmed, sending: false });

/** The box was left with this value. Says whether to send it now. */
export function wantValue(s: HoleSync, desired: number | null): SyncStep {
  if (s.sending) return { state: { ...s, desired }, send: null };
  if (desired === s.confirmed) return { state: { ...s, desired }, send: null };
  return { state: { ...s, desired, sending: true }, send: { value: desired } };
}

/** A save of `sent` finished. If the latest typed value differs from what is now confirmed, send it next. */
export function saveFinished(s: HoleSync, sent: number | null, ok: boolean): SyncStep {
  if (!ok) return { state: { ...s, sending: false }, send: null };
  const confirmed = sent;
  if (s.desired !== confirmed) return { state: { ...s, confirmed, sending: true }, send: { value: s.desired } };
  return { state: { ...s, confirmed, sending: false }, send: null };
}
