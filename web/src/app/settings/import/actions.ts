"use server";

import { revalidatePath } from "next/cache";
import { readBackup } from "@/lib/backup";
import { currentStaff, SIGNED_OUT } from "@/lib/db/auth";
import { fetchAll } from "@/lib/db/paging";
import { MAX_BACKUP_BYTES } from "@/lib/importPlan";
import { importBundles, TOO_BIG, type ImportStore } from "@/lib/importRun";
import { createServerSupabase } from "@/lib/supabase/server";

export type ImportResult = {
  imported: string[];
  skipped: { name: string; reason: string }[];
  /** Full messages for events that did not make it in ("Couldn't import X."). */
  failed: string[];
  error?: string;
};

const none = (error: string): ImportResult => ({ imported: [], skipped: [], failed: [], error });

/** Adds each scramble in the backup as a NEW event. Existing events are never touched. */
export async function importBackup(text: string): Promise<ImportResult> {
  const me = await currentStaff();
  if (!me) return none(SIGNED_OUT);
  if (typeof text !== "string" || Buffer.byteLength(text, "utf8") > MAX_BACKUP_BYTES) return none(TOO_BIG);

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

  const store: ImportStore = {
    // Table names are our own fixed strings; rows are built by bundleToRows.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    insert: (table, rows) => (supabase.from(table as any) as any).insert(rows),
    softDelete: (table, ids) => supabase.from(table).update({ deleted_at: new Date().toISOString() }).in("id", ids),
  };
  const run = await importBundles(
    store,
    backup.bundles,
    me.clubId,
    (events.data ?? []).map((e) => e.name),
    (golfers.data ?? []).map((g) => ({ id: g.id, name: g.name })),
  );
  revalidatePath("/", "layout");
  return { imported: run.imported, skipped: backup.skipped, failed: run.failed };
}
