// Prize money for one leaderboard (a flight's gross or net board).
// Club rule: ties are not broken. Tied teams share the combined money for
// the places they cover equally (two tied for 2nd split 2nd + 3rd).

export interface Placed {
  id: string;
  /** 1 = first; tied entries share a position. null = not placed. */
  position: number | null;
  eligible: boolean;
}

/**
 * purse: total for this board. split: place percentages, e.g. [50, 30, 20]
 * (scaled to the purse if they don't add to 100). Returns money per id;
 * ids that win nothing are left out. Amounts are not rounded.
 */
export function payout(rows: Placed[], purse: number, split: number[]): Map<string, number> {
  const total = split.reduce((a, b) => a + b, 0);
  const places = total > 0 ? split.map((s) => (purse * s) / total) : [];
  const placed = rows.filter((r) => r.eligible && r.position !== null);
  const out = new Map<string, number>();
  const positions = [...new Set(placed.map((r) => r.position!))].sort((a, b) => a - b);
  for (const pos of positions) {
    const group = placed.filter((r) => r.position === pos);
    const money = places.slice(pos - 1, pos - 1 + group.length).reduce((a, b) => a + b, 0);
    if (money > 0) group.forEach((r) => out.set(r.id, money / group.length));
  }
  return out;
}
