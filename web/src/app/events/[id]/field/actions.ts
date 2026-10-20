"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentStaff, SIGNED_OUT } from "@/lib/db/auth";
import { EVENT_NOT_FOUND, loadEvent } from "@/lib/db/events";
import { fetchAll } from "@/lib/db/paging";
import { planImport, type RosterGolfer } from "@/lib/fieldImport";
import type { ImportedPlayer } from "@/lib/import/parse";
import { createServerSupabase } from "@/lib/supabase/server";
import type { EventBundle } from "@/lib/types";

/** What Undo needs to put the field back: new entries to remove, removed entries to bring back. */
export type FieldUndo = { remove: string[]; restore: string[] };
type Fail = { ok: false; error: string };
export type ImportResult =
  | { ok: true; added: number; alreadyIn: number; entryIds: string[]; undo: FieldUndo }
  | Fail;

const BAD: Fail = { ok: false, error: "That didn't look right. Reload the page and try again." };
const SAVE_FAILED: Fail = { ok: false, error: "That didn't save. Try again." };

const Player = z.object({
  name: z.string().trim().min(1).max(120),
  index: z.number().min(-10).max(54),
  nh: z.boolean(),
  teeName: z.string().max(80).nullable(),
  teeUnknown: z.boolean(),
  ghin: z.string().max(20).nullable(),
  group: z.string().max(120).nullable(),
  row: z.number().int().min(0),
});
const Players = z.array(Player).max(2000);

function refresh(eventId: string) {
  revalidatePath(`/events/${eventId}`, "layout");
}

async function load(eventId: string): Promise<EventBundle | Fail> {
  try {
    return await loadEvent(eventId);
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message === EVENT_NOT_FOUND ? "That event wasn't found." : "Couldn't load the event. Try again." };
  }
}

async function clubRoster(): Promise<RosterGolfer[] | null> {
  const supabase = await createServerSupabase();
  const res = await fetchAll((from, to) =>
    supabase.from("golfers").select("id, name, ghin_number").is("deleted_at", null).order("created_at").order("id").range(from, to),
  );
  if (res.error) return null;
  return (res.data ?? []).map((g) => ({ id: g.id, name: g.name, ghin: g.ghin_number }));
}

/** created_at values one millisecond apart, so "order added" survives a batch insert. */
const stamps = (n: number) => {
  const base = Date.now();
  return Array.from({ length: n }, (_, i) => new Date(base + i).toISOString());
};

async function softSet(table: "entries", ids: string[], eventId: string, when: string | null): Promise<boolean> {
  if (!ids.length) return true;
  const supabase = await createServerSupabase();
  const { error } = await supabase.from(table).update({ deleted_at: when }).in("id", ids).eq("event_id", eventId);
  return !error;
}

/**
 * Adds imported players to the field ("add"), or swaps the whole field for them ("replace").
 * Golfers are matched to the club roster by GHIN number, else exact name; new ones join the roster.
 * Replace is refused while teams exist.
 */
export async function importPlayers(eventId: string, players: ImportedPlayer[], mode: "add" | "replace"): Promise<ImportResult> {
  if (!(await currentStaff())) return { ok: false, error: SIGNED_OUT };
  const parsed = Players.safeParse(players);
  if (!parsed.success || (mode !== "add" && mode !== "replace")) return BAD;
  if (!parsed.data.length) return { ok: false, error: "There are no players to add." };

  const bundle = await load(eventId);
  if ("ok" in bundle) return bundle;
  if (mode === "replace" && bundle.teams.length) return { ok: false, error: "Clear the teams first, then replace the field." };

  const roster = await clubRoster();
  if (!roster) return { ok: false, error: "Couldn't load the club roster. Try again." };

  const current = mode === "replace" ? [] : bundle.entries;
  const plan = planImport(
    parsed.data as ImportedPlayer[],
    roster,
    bundle.tees,
    new Set(current.map((e) => e.golferId)),
    randomUUID,
  );

  const supabase = await createServerSupabase();
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: SIGNED_OUT };

  if (plan.newGolfers.length) {
    const { error } = await supabase.from("golfers").insert(
      plan.newGolfers.map((g) => ({
        id: g.id,
        club_id: staff.clubId,
        name: g.name,
        index: g.index,
        nh: g.nh,
        ghin_number: g.ghin,
      })),
    );
    if (error) return SAVE_FAILED;
  }

  const fresh = plan.entries.flatMap((e) => (e ? [e] : []));
  const entryIds = fresh.map(() => randomUUID());
  const times = stamps(fresh.length);
  if (fresh.length) {
    const { error } = await supabase.from("entries").insert(
      fresh.map((e, i) => ({
        id: entryIds[i],
        event_id: eventId,
        golfer_id: e.golferId,
        index_used: e.index,
        nh: e.nh,
        tee_id: e.teeId,
        alternate: false,
        created_at: times[i],
      })),
    );
    if (error) return SAVE_FAILED;
  }

  const oldIds = mode === "replace" ? bundle.entries.map((e) => e.id) : [];
  if (!(await softSet("entries", oldIds, eventId, new Date().toISOString()))) {
    await softSet("entries", entryIds, eventId, new Date().toISOString());
    return SAVE_FAILED;
  }

  // The entry for every imported row, whether it is new or the golfer was already in the field.
  const entryByGolfer = new Map(current.map((e) => [e.golferId, e.id]));
  let k = 0;
  const rowEntries = plan.entries.map((e, i) => {
    if (e) {
      const id = entryIds[k++];
      entryByGolfer.set(e.golferId, id);
      return id;
    }
    return entryByGolfer.get(plan.golferIds[i]) ?? "";
  });

  refresh(eventId);
  return {
    ok: true,
    added: fresh.length,
    alreadyIn: plan.entries.length - fresh.length,
    entryIds: rowEntries,
    undo: { remove: entryIds, restore: oldIds },
  };
}

/** Puts the field back the way it was before an import or roster add. */
export async function undoFieldChange(eventId: string, undo: FieldUndo): Promise<{ ok: true } | Fail> {
  if (!(await currentStaff())) return { ok: false, error: SIGNED_OUT };
  const ids = z.object({ remove: z.array(z.string().uuid()), restore: z.array(z.string().uuid()) }).safeParse(undo);
  if (!ids.success) return BAD;
  const bundle = await load(eventId);
  if ("ok" in bundle) return bundle;
  if (bundle.teams.length) return { ok: false, error: "Teams were made since. Clear the teams first, then undo." };
  const ok =
    (await softSet("entries", ids.data.remove, eventId, new Date().toISOString())) &&
    (await softSet("entries", ids.data.restore, eventId, null));
  if (!ok) return SAVE_FAILED;
  refresh(eventId);
  return { ok: true };
}

/** Adds golfers already on the club roster to this event's field. Golfers already in it are skipped. */
export async function addFromRoster(eventId: string, golferIds: string[]): Promise<ImportResult> {
  if (!(await currentStaff())) return { ok: false, error: SIGNED_OUT };
  const ids = z.array(z.string().uuid()).min(1).max(500).safeParse(golferIds);
  if (!ids.success) return BAD;
  const bundle = await load(eventId);
  if ("ok" in bundle) return bundle;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("golfers")
    .select("id, index, nh")
    .in("id", ids.data)
    .is("deleted_at", null);
  if (error) return { ok: false, error: "Couldn't load the roster. Try again." };

  const inField = new Set(bundle.entries.map((e) => e.golferId));
  const picked = (data ?? []).filter((g) => !inField.has(g.id));
  const entryIds = picked.map(() => randomUUID());
  const times = stamps(picked.length);
  if (picked.length) {
    const { error: insertError } = await supabase.from("entries").insert(
      picked.map((g, i) => ({
        id: entryIds[i],
        event_id: eventId,
        golfer_id: g.id,
        index_used: g.index === null ? 0 : Number(g.index),
        nh: g.nh || g.index === null,
        tee_id: bundle.tees[0]?.id ?? null,
        alternate: false,
        created_at: times[i],
      })),
    );
    if (insertError) return SAVE_FAILED;
  }
  refresh(eventId);
  return { ok: true, added: picked.length, alreadyIn: ids.data.length - picked.length, entryIds, undo: { remove: entryIds, restore: [] } };
}

const Patch = z
  .object({
    indexUsed: z.number().min(-10).max(54).transform((n) => Math.round(n * 10) / 10),
    nh: z.boolean(),
    teeId: z.string().uuid().nullable(),
  })
  .partial()
  .strict();

/** Changes one player's index, no-handicap flag or tee for this event. */
export async function setEntry(
  entryId: string,
  patch: { indexUsed?: number; nh?: boolean; teeId?: string | null },
): Promise<{ ok: true } | Fail> {
  if (!(await currentStaff())) return { ok: false, error: SIGNED_OUT };
  const p = Patch.safeParse(patch);
  if (!p.success) return { ok: false, error: "Enter a handicap index between +10 and 54 (type plus handicaps as negative numbers)." };
  const row: { index_used?: number; nh?: boolean; tee_id?: string | null } = {};
  if (p.data.indexUsed !== undefined) row.index_used = p.data.indexUsed;
  if (p.data.nh !== undefined) row.nh = p.data.nh;
  if (p.data.teeId !== undefined) row.tee_id = p.data.teeId;
  if (!Object.keys(row).length) return { ok: true };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("entries").update(row).eq("id", entryId).is("deleted_at", null).select("id, event_id");
  if (error || !data?.length) return SAVE_FAILED;
  refresh(data[0].event_id);
  return { ok: true };
}
