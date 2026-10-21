import type { EventBundle } from "./types";
import { bundleToRows, type ImportPlan } from "./importPlan";

export const SCORE_BATCH = 500;
export const TOO_BIG = "That file is too big (over 5 MB).";

type Outcome = { error: unknown };
export type SoftTable = "events" | "courses" | "golfers" | "entries" | "teams" | "groups";

/** The database calls the import needs (the server action backs this with Supabase; tests use a fake). */
export interface ImportStore {
  insert(table: string, rows: object[]): PromiseLike<Outcome>;
  softDelete(table: SoftTable, ids: string[]): PromiseLike<Outcome>;
}

export interface RunResult {
  imported: string[];
  /** Plain messages, one per event that did not make it in. */
  failed: string[];
}

/** Score rows must be 1..20 (the database enforces it). Returns a message, or null when fine. */
export function scoreProblem(bundle: EventBundle): string | null {
  const bad = bundle.scores.find((s) => s.gross !== null && !(Number.isInteger(s.gross) && s.gross >= 1 && s.gross <= 20));
  return bad ? `Couldn't import ${bundle.event.name}: a score was out of range (hole ${bad.hole}).` : null;
}

/**
 * Imports each bundle as a new event. One event failing never stops the others.
 * Orphans (rounds, tees, links, scores) under a soft-deleted event/course are intentional: users can't delete rows.
 */
export async function importBundles(
  store: ImportStore,
  bundles: EventBundle[],
  clubId: string,
  eventNames: string[],
  roster: { id: string; name: string }[],
): Promise<RunResult> {
  const result: RunResult = { imported: [], failed: [] };
  for (const bundle of bundles) {
    try {
      const range = scoreProblem(bundle);
      if (range) {
        result.failed.push(range);
        continue;
      }
      const plan = bundleToRows(bundle, clubId, eventNames, roster);
      const failure = await insertPlan(store, plan, bundle.event.name);
      if (failure === null) {
        result.imported.push(plan.eventName);
        eventNames.push(plan.eventName);
        roster.push(...plan.newGolfers.map((g) => ({ id: g.id as string, name: g.name })));
      } else {
        result.failed.push(failure);
      }
    } catch {
      result.failed.push(`Couldn't import ${bundle.event.name}.`);
    }
  }
  return result;
}

/** Inserts in dependency order. On failure soft-deletes what this import added; returns null on success, else a message. */
async function insertPlan(store: ImportStore, p: ImportPlan, name: string): Promise<string | null> {
  const made: Partial<Record<SoftTable, boolean>> = {};
  const step = async (table: string, rows: object[], flag?: SoftTable) => {
    if (!rows.length) return;
    if (flag) made[flag] = true; // set first: a failed insert may still have written, so cleanup is a safe superset
    if ((await store.insert(table, rows)).error) throw new Error(table);
  };
  try {
    await step("courses", [p.course], "courses");
    await step("tees", p.tees);
    await step("golfers", p.newGolfers, "golfers");
    await step("events", [p.event], "events");
    await step("entries", p.entries, "entries");
    await step("teams", p.teams, "teams");
    await step("team_members", p.teamMembers);
    await step("rounds", p.rounds);
    await step("groups", p.groups, "groups");
    await step("group_teams", p.groupTeams);
    for (let i = 0; i < p.scores.length; i += SCORE_BATCH) await step("scores", p.scores.slice(i, i + SCORE_BATCH));
    return null;
  } catch {
    return (await rollback(store, p, made))
      ? `Couldn't import ${name}.`
      : `Couldn't import ${name}; a partial copy may remain.`;
  }
}

/** Returns false when anything could not be hidden. */
async function rollback(store: ImportStore, p: ImportPlan, made: Partial<Record<SoftTable, boolean>>): Promise<boolean> {
  const ids = (rows: { id?: string }[]) => rows.map((r) => r.id as string);
  const jobs: [SoftTable, string[]][] = [
    ["events", [p.event.id as string]],
    ["entries", ids(p.entries)],
    ["teams", ids(p.teams)],
    ["groups", ids(p.groups)],
    ["golfers", ids(p.newGolfers)],
    ["courses", [p.course.id as string]],
  ];
  let clean = true;
  for (const [table, list] of jobs) {
    if (!made[table]) continue;
    for (let i = 0; i < list.length; i += 200) {
      try {
        if ((await store.softDelete(table, list.slice(i, i + 200))).error) clean = false;
      } catch {
        clean = false;
      }
    }
  }
  return clean;
}
