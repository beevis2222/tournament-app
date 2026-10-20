"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentStaff, SIGNED_OUT } from "@/lib/db/auth";
import { EVENT_NOT_FOUND, loadEvent } from "@/lib/db/events";
import { flightAssignments, planTeams, SCORES_WARNING, type SheetGroup, type TeamDraft } from "@/lib/teamPlan";
import { createServerSupabase } from "@/lib/supabase/server";
import { hasCourse } from "@/lib/toEngine";
import type { EventBundle } from "@/lib/types";

type Fail = { ok: false; error: string; needsConfirm?: true };
/** What Undo needs: new teams to remove, old teams to bring back, and the alternate flags that changed. */
export type TeamsUndo = { newTeamIds: string[]; oldTeamIds: string[]; becameAlternate: string[]; becamePlaying: string[] };
export type TeamsResult = { ok: true; teams: number; alternates: number; undo: TeamsUndo } | Fail;

const BAD: Fail = { ok: false, error: "That didn't look right. Reload the page and try again." };
const SAVE_FAILED: Fail = { ok: false, error: "That didn't save. Try again." };

const NEEDS_CONFIRM: Fail = { ok: false, error: SCORES_WARNING, needsConfirm: true };

/** True when any score has been entered for the event's current teams. */
function hasScores(bundle: EventBundle): boolean {
  const current = new Set(bundle.teams.map((t) => t.id));
  return bundle.scores.some((s) => current.has(s.teamId) && s.gross !== null);
}

const refresh = (eventId: string) => revalidatePath(`/events/${eventId}`, "layout");

async function load(eventId: string): Promise<EventBundle | Fail> {
  try {
    return await loadEvent(eventId);
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message === EVENT_NOT_FOUND ? "That event wasn't found." : "Couldn't load the event. Try again." };
  }
}

/**
 * Swaps the event's teams for new ones: the new teams go in first, then the old ones are
 * soft-removed (Undo brings them back), then alternate flags are set. A failure part-way
 * removes the new teams again so the old ones stay.
 */
async function replaceTeams(
  eventId: string,
  bundle: EventBundle,
  teams: TeamDraft[],
  alternates: string[],
): Promise<TeamsResult> {
  const supabase = await createServerSupabase();
  const now = new Date().toISOString();
  const newTeamIds = teams.map(() => randomUUID());
  const oldTeamIds = bundle.teams.map((t) => t.id);
  const undoNew = async () => {
    if (newTeamIds.length) await supabase.from("teams").update({ deleted_at: now }).in("id", newTeamIds).eq("event_id", eventId);
  };

  if (teams.length) {
    const ins = await supabase
      .from("teams")
      .insert(teams.map((t, i) => ({ id: newTeamIds[i], event_id: eventId, label: t.label, sort: i + 1 })));
    if (ins.error) return SAVE_FAILED;
    const members = await supabase
      .from("team_members")
      .insert(teams.flatMap((t, i) => t.entryIds.map((entryId, j) => ({ team_id: newTeamIds[i], entry_id: entryId, sort: j }))));
    if (members.error) {
      await undoNew();
      return SAVE_FAILED;
    }
  }
  if (oldTeamIds.length) {
    const del = await supabase.from("teams").update({ deleted_at: now }).in("id", oldTeamIds).eq("event_id", eventId);
    if (del.error) {
      await undoNew();
      return SAVE_FAILED;
    }
  }

  const want = new Set(alternates);
  const becameAlternate = bundle.entries.filter((e) => want.has(e.id) && !e.alternate).map((e) => e.id);
  const becamePlaying = bundle.entries.filter((e) => !want.has(e.id) && e.alternate).map((e) => e.id);
  const flags = await setAlternates(eventId, becameAlternate, becamePlaying);
  if (!flags) return { ok: false, error: "Teams were made, but the alternates didn't save. Make the teams again." };

  refresh(eventId);
  return { ok: true, teams: teams.length, alternates: alternates.length, undo: { newTeamIds, oldTeamIds, becameAlternate, becamePlaying } };
}

async function setAlternates(eventId: string, on: string[], off: string[]): Promise<boolean> {
  const supabase = await createServerSupabase();
  if (on.length) {
    const { error } = await supabase.from("entries").update({ alternate: true }).in("id", on).eq("event_id", eventId);
    if (error) return false;
  }
  if (off.length) {
    const { error } = await supabase.from("entries").update({ alternate: false }).in("id", off).eq("event_id", eventId);
    if (error) return false;
  }
  return true;
}

const Groups = z
  .array(z.object({ label: z.string().trim().min(1).max(60), entryIds: z.array(z.string().uuid()).min(1) }))
  .max(200);

/**
 * "balanced": snake draft by index. "listed": players in the order added, or the spreadsheet's
 * groups when `groups` is given. Uses every player in the field (alternate flags are reset).
 * Replaces the current teams; Undo brings them back.
 */
export async function makeTeams(
  eventId: string,
  mode: "listed" | "balanced",
  groups?: SheetGroup[],
  confirmScores?: boolean,
): Promise<TeamsResult> {
  if (!(await currentStaff())) return { ok: false, error: SIGNED_OUT };
  if (mode !== "listed" && mode !== "balanced") return BAD;
  const g = groups === undefined ? undefined : Groups.safeParse(groups);
  if (g && !g.success) return BAD;
  const bundle = await load(eventId);
  if ("ok" in bundle) return bundle;
  const size = bundle.event.settings.teamSize;
  if (hasScores(bundle) && confirmScores !== true) return NEEDS_CONFIRM;

  if (g?.success) {
    const known = new Set(bundle.entries.map((e) => e.id));
    const seen = new Set<string>();
    for (const grp of g.data) {
      if (grp.entryIds.length > size) return { ok: false, error: `“${grp.label}” has ${grp.entryIds.length} players, but teams are ${size}.` };
      for (const id of grp.entryIds) {
        if (!known.has(id) || seen.has(id)) return BAD;
        seen.add(id);
      }
    }
  }
  const plan = planTeams(bundle, mode, g?.success ? g.data : undefined);
  if (!plan.teams.length) {
    return { ok: false, error: `You need at least ${size} players in the field to make a team.` };
  }
  return replaceTeams(eventId, bundle, plan.teams, plan.alternates);
}

/** Removes all teams (Undo brings them back). Everyone in the field goes back to "not on a team". */
export async function clearTeams(eventId: string, confirmScores?: boolean): Promise<TeamsResult> {
  if (!(await currentStaff())) return { ok: false, error: SIGNED_OUT };
  const bundle = await load(eventId);
  if ("ok" in bundle) return bundle;
  if (!bundle.teams.length) return { ok: false, error: "There are no teams to clear." };
  if (hasScores(bundle) && confirmScores !== true) return NEEDS_CONFIRM;
  return replaceTeams(eventId, bundle, [], []);
}

/**
 * Brings back a set of removed teams (all removed at the same moment) and removes the current teams.
 * Undo (undoTeams) reverses it. Alternate flags are left as they are.
 */
export async function restoreTeamSet(eventId: string, removedAt: string, confirmScores?: boolean): Promise<TeamsResult> {
  if (!(await currentStaff())) return { ok: false, error: SIGNED_OUT };
  if (!z.string().datetime({ offset: true }).safeParse(removedAt).success) return BAD;
  const bundle = await load(eventId);
  if ("ok" in bundle) return bundle;
  if (hasScores(bundle) && confirmScores !== true) return NEEDS_CONFIRM;
  const supabase = await createServerSupabase();
  const found = await supabase.from("teams").select("id").eq("event_id", eventId).eq("deleted_at", removedAt);
  if (found.error) return SAVE_FAILED;
  const restoreIds = (found.data ?? []).map((t) => t.id);
  if (!restoreIds.length) return { ok: false, error: "Those teams weren't found. Reload the page." };
  const oldTeamIds = bundle.teams.map((t) => t.id);
  const now = new Date().toISOString();
  if (oldTeamIds.length) {
    const del = await supabase.from("teams").update({ deleted_at: now }).in("id", oldTeamIds).eq("event_id", eventId);
    if (del.error) return SAVE_FAILED;
  }
  const back = await supabase.from("teams").update({ deleted_at: null }).in("id", restoreIds).eq("event_id", eventId);
  if (back.error) {
    if (oldTeamIds.length) await supabase.from("teams").update({ deleted_at: null }).in("id", oldTeamIds).eq("event_id", eventId);
    return SAVE_FAILED;
  }
  refresh(eventId);
  return { ok: true, teams: restoreIds.length, alternates: 0, undo: { newTeamIds: restoreIds, oldTeamIds, becameAlternate: [], becamePlaying: [] } };
}

/** Reverses makeTeams or clearTeams. */
export async function undoTeams(eventId: string, undo: TeamsUndo): Promise<{ ok: true } | Fail> {
  if (!(await currentStaff())) return { ok: false, error: SIGNED_OUT };
  const ids = z.array(z.string().uuid());
  const parsed = z
    .object({ newTeamIds: ids, oldTeamIds: ids, becameAlternate: ids, becamePlaying: ids })
    .safeParse(undo);
  if (!parsed.success) return BAD;
  const u = parsed.data;
  const supabase = await createServerSupabase();
  const now = new Date().toISOString();
  if (u.newTeamIds.length) {
    const { error } = await supabase.from("teams").update({ deleted_at: now }).in("id", u.newTeamIds).eq("event_id", eventId);
    if (error) return SAVE_FAILED;
  }
  if (u.oldTeamIds.length) {
    const { error } = await supabase.from("teams").update({ deleted_at: null }).in("id", u.oldTeamIds).eq("event_id", eventId);
    if (error) return SAVE_FAILED;
  }
  if (!(await setAlternates(eventId, u.becamePlaying, u.becameAlternate))) return SAVE_FAILED;
  refresh(eventId);
  return { ok: true };
}

/**
 * Moves a player to another team, or to the alternates (null). A team may end up short; the
 * Pre-event check flags that. A player already sitting out keeps an old team link that is
 * ignored while they are an alternate, because links are never deleted.
 */
export async function moveEntry(entryId: string, toTeamId: string | null): Promise<{ ok: true } | Fail> {
  if (!(await currentStaff())) return { ok: false, error: SIGNED_OUT };
  if (typeof entryId !== "string" || (toTeamId !== null && typeof toTeamId !== "string")) return BAD;
  const supabase = await createServerSupabase();

  const found = await supabase.from("entries").select("id, event_id, alternate").eq("id", entryId).is("deleted_at", null).maybeSingle();
  if (found.error || !found.data) return SAVE_FAILED;
  const eventId = found.data.event_id;
  const bundle = await load(eventId);
  if ("ok" in bundle) return bundle;

  if (toTeamId === null) {
    const { error } = await supabase.from("entries").update({ alternate: true }).eq("id", entryId);
    if (error) return SAVE_FAILED;
    refresh(eventId);
    return { ok: true };
  }

  const target = bundle.teams.find((t) => t.id === toTeamId);
  if (!target) return { ok: false, error: "That team wasn't found. Reload the page." };
  const playing = (ids: string[]) => ids.filter((id) => id !== entryId && !bundle.entries.find((e) => e.id === id)?.alternate);
  const size = bundle.event.settings.teamSize;
  if (playing(target.entryIds).length >= size) {
    return { ok: false, error: `${target.label} already has ${size} players. Move someone out first.` };
  }

  const current = bundle.teams.find((t) => t.entryIds.includes(entryId));
  const sort = target.entryIds.length;
  if (current?.id !== target.id) {
    const res = current
      ? await supabase.from("team_members").update({ team_id: target.id, sort }).eq("team_id", current.id).eq("entry_id", entryId).select("entry_id")
      : await supabase.from("team_members").insert({ team_id: target.id, entry_id: entryId, sort }).select("entry_id");
    if (res.error || !res.data?.length) return SAVE_FAILED;
  }
  if (found.data.alternate) {
    const { error } = await supabase.from("entries").update({ alternate: false }).eq("id", entryId);
    if (error) return SAVE_FAILED;
  }
  refresh(eventId);
  return { ok: true };
}

/** Splits the teams into the event's number of flights by team handicap. Needs a course. */
export async function setFlights(eventId: string): Promise<{ ok: true; flights: number } | Fail> {
  if (!(await currentStaff())) return { ok: false, error: SIGNED_OUT };
  const bundle = await load(eventId);
  if ("ok" in bundle) return bundle;
  if (!hasCourse(bundle)) return { ok: false, error: "Choose a course first." };
  if (!bundle.teams.length) return { ok: false, error: "Make teams first." };

  const byFlight = new Map<number, string[]>();
  for (const [teamId, flight] of flightAssignments(bundle)) byFlight.set(flight, [...(byFlight.get(flight) ?? []), teamId]);
  const supabase = await createServerSupabase();
  for (const [flight, ids] of byFlight) {
    const { error } = await supabase.from("teams").update({ flight }).in("id", ids).eq("event_id", eventId);
    if (error) return SAVE_FAILED;
  }
  refresh(eventId);
  return { ok: true, flights: byFlight.size };
}

/** WD / DQ / NS for a team, or null to clear it. */
export async function setTeamStatus(teamId: string, status: "WD" | "DQ" | "NS" | null): Promise<{ ok: true } | Fail> {
  if (!(await currentStaff())) return { ok: false, error: SIGNED_OUT };
  if (status !== null && status !== "WD" && status !== "DQ" && status !== "NS") return BAD;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("teams").update({ status }).eq("id", teamId).is("deleted_at", null).select("id, event_id");
  if (error || !data?.length) return SAVE_FAILED;
  refresh(data[0].event_id);
  return { ok: true };
}
