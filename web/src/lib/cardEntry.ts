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
