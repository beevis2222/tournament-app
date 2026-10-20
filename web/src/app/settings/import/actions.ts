"use server";

import { revalidatePath } from "next/cache";
import { readBackup } from "@/lib/backup";
import { currentStaff, SIGNED_OUT } from "@/lib/db/auth";
import { fetchAll } from "@/lib/db/paging";
import { bundleToRows, MAX_BACKUP_BYTES, type ImportPlan } from "@/lib/importPlan";
import { createServerSupabase } from "@/lib/supabase/server";

const SCORE_BATCH = 500;

export type ImportResult = {
  imported: string[];
  skipped: { name: string; reason: string }[];
  /** Events that hit a problem and were rolled back (soft-deleted). */
  failed: string[];
  error?: string;
};

const none = (error: string): ImportResult => ({ imported: [], skipped: [], failed: [], error });

/** Adds each scramble in the backup as a NEW event. Existing events are never touched. */
export async function importBackup(text: string): Promise<ImportResult> {
  const me = await currentStaff();
  if (!me) return none(SIGNED_OUT);
  if (typeof text !== "string" || text.length > MAX_BACKUP_BYTES) return none("That file is too big to be a backup (limit 5 MB).");

  let backup;
  try {
    backup = readBackup(text);
  } catch (e) {
    return none(e instanceof Error ? e.message : "That file isn't a backup from this app.");
  }

  const supabase = await createServerSupabase();
  const [events, golfers] = await Promise.all([
    fetchAll((from, to) => supabase.from("events").select("name").is("deleted_at", null).order("id").range(from, to)),
    fetchAll((from, to) => supabase.from("golfers").select("id, name").is("deleted_at", null).order("id").range(from, to)),
  ]);
  if (events.error || golfers.error) return none("Couldn't check your existing events. Try again.");

  const eventNames = (events.data ?? []).map((e) => e.name);
  const roster = (golfers.data ?? []).map((g) => ({ id: g.id, name: g.name }));
  const result: ImportResult = { imported: [], skipped: backup.skipped, failed: [] };

  for (const bundle of backup.bundles) {
    const plan = bundleToRows(bundle, me.clubId, eventNames, roster);
    const ok = await insertPlan(supabase, plan);
    if (ok) {
      result.imported.push(plan.eventName);
      eventNames.push(plan.eventName);
      roster.push(...plan.newGolfers.map((g) => ({ id: g.id as string, name: g.name })));
    } else {
      result.failed.push(bundle.event.name);
    }
  }
  revalidatePath("/", "layout");
  return result;
}

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

/** Inserts in dependency order. On any failure soft-deletes what was added and returns false. */
async function insertPlan(supabase: Supabase, p: ImportPlan): Promise<boolean> {
  const made = { course: false, golfers: false, event: false, entries: false, teams: false, groups: false };
  const ok = async (step: PromiseLike<{ error: unknown }>) => !(await step).error;
  try {
    const steps: [keyof typeof made | null, () => PromiseLike<{ error: unknown }>][] = [
      ["course", () => supabase.from("courses").insert(p.course)],
      [null, () => (p.tees.length ? supabase.from("tees").insert(p.tees) : Promise.resolve({ error: null }))],
      ["golfers", () => (p.newGolfers.length ? supabase.from("golfers").insert(p.newGolfers) : Promise.resolve({ error: null }))],
      ["event", () => supabase.from("events").insert(p.event)],
      ["entries", () => (p.entries.length ? supabase.from("entries").insert(p.entries) : Promise.resolve({ error: null }))],
      ["teams", () => (p.teams.length ? supabase.from("teams").insert(p.teams) : Promise.resolve({ error: null }))],
      [null, () => (p.teamMembers.length ? supabase.from("team_members").insert(p.teamMembers) : Promise.resolve({ error: null }))],
      [null, () => supabase.from("rounds").insert(p.rounds)],
      ["groups", () => (p.groups.length ? supabase.from("groups").insert(p.groups) : Promise.resolve({ error: null }))],
      [null, () => (p.groupTeams.length ? supabase.from("group_teams").insert(p.groupTeams) : Promise.resolve({ error: null }))],
    ];
    for (const [flag, run] of steps) {
      // A step that fails may still have written nothing; mark it first so cleanup is a safe superset.
      if (flag) made[flag] = true;
      if (!(await ok(run()))) throw new Error("step failed");
    }
    for (let i = 0; i < p.scores.length; i += SCORE_BATCH) {
      if (!(await ok(supabase.from("scores").insert(p.scores.slice(i, i + SCORE_BATCH))))) throw new Error("scores failed");
    }
    return true;
  } catch {
    await rollback(supabase, p, made);
    return false;
  }
}

async function rollback(supabase: Supabase, p: ImportPlan, made: Record<string, boolean>) {
  const now = new Date().toISOString();
  const ids = (rows: { id?: string }[]) => rows.map((r) => r.id as string);
  const undo = async (table: "events" | "courses" | "golfers" | "entries" | "teams" | "groups", list: string[]) => {
    for (let i = 0; i < list.length; i += 200) {
      try {
        await supabase.from(table).update({ deleted_at: now }).in("id", list.slice(i, i + 200));
      } catch {
        // Best effort: keep going so the rest is still hidden.
      }
    }
  };
  // Only rows this import created: ids are the bundle's own fresh ones, never an existing event's.
  if (made.event) await undo("events", [p.event.id as string]);
  if (made.entries) await undo("entries", ids(p.entries));
  if (made.teams) await undo("teams", ids(p.teams));
  if (made.groups) await undo("groups", ids(p.groups));
  if (made.golfers) await undo("golfers", ids(p.newGolfers));
  if (made.course) await undo("courses", [p.course.id as string]);
}
