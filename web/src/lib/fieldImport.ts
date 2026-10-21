import type { ImportedPlayer } from "@/lib/import/parse";

export interface RosterGolfer {
  id: string;
  name: string;
  ghin: string | null;
}

export interface NewGolfer {
  id: string;
  name: string;
  index: number | null;
  nh: boolean;
  ghin: string | null;
}

export interface PlannedEntry {
  golferId: string;
  index: number;
  nh: boolean;
  teeId: string | null;
}

const digits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "") || null;
const nameKey = (n: string) => n.trim().toLowerCase();

/**
 * Works out which roster golfer each imported player is, and which golfers are new.
 * Match by GHIN number when both have one; otherwise by exact name (case-insensitive,
 * trimmed). Two people with the same name but different GHIN numbers are different golfers.
 * `entries[i]` is null when that player's golfer is already in `alreadyIn` (or earlier in this import).
 */
export function planImport(
  players: ImportedPlayer[],
  roster: RosterGolfer[],
  tees: { id: string; name: string }[],
  alreadyIn: Set<string>,
  newId: () => string,
): { newGolfers: NewGolfer[]; entries: (PlannedEntry | null)[]; golferIds: string[] } {
  const all: RosterGolfer[] = roster.map((g) => ({ ...g, ghin: digits(g.ghin) }));
  const newGolfers: NewGolfer[] = [];
  const used = new Set(alreadyIn);
  const entries: (PlannedEntry | null)[] = [];
  const golferIds: string[] = [];

  const teeId = (name: string | null) => {
    const hit = name ? tees.find((t) => t.name.toLowerCase() === name.toLowerCase()) : undefined;
    return hit?.id ?? tees[0]?.id ?? null;
  };

  for (const p of players) {
    const ghin = digits(p.ghin);
    const byGhin = ghin ? all.find((g) => g.ghin === ghin) : undefined;
    const found =
      byGhin ??
      all.find((g) => nameKey(g.name) === nameKey(p.name) && !(ghin && g.ghin && ghin !== g.ghin));
    let golferId: string;
    if (found) golferId = found.id;
    else {
      golferId = newId();
      all.push({ id: golferId, name: p.name.trim(), ghin });
      newGolfers.push({ id: golferId, name: p.name.trim(), index: p.nh ? null : p.index, nh: p.nh, ghin });
    }
    golferIds.push(golferId);
    if (used.has(golferId)) {
      entries.push(null);
      continue;
    }
    used.add(golferId);
    entries.push({ golferId, index: p.nh ? 0 : p.index, nh: p.nh, teeId: teeId(p.teeName) });
  }
  return { newGolfers, entries, golferIds };
}
