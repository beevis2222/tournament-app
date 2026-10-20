"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentStaff, SIGNED_OUT } from "@/lib/db/auth";
import { EVENT_NOT_FOUND, loadEvent } from "@/lib/db/events";
import { buildGroups, type DraftGroup } from "@/lib/pairings";
import { checkStart, planMove } from "@/lib/pairingEdit";
import { createServerSupabase } from "@/lib/supabase/server";
import { EventSettings, type EventBundle } from "@/lib/types";

type Fail = { ok: false; error: string };
/** What Undo needs: the new groups to remove and the old groups to bring back. */
export type PairingsUndo = { newGroupIds: string[]; oldGroupIds: string[] };
export type PairingsResult = { ok: true; groups: number; undo: PairingsUndo } | Fail;

const BAD: Fail = { ok: false, error: "That didn't look right. Reload the page and try again." };
const SAVE_FAILED: Fail = { ok: false, error: "That didn't save. Try again." };

const refresh = (eventId: string) => revalidatePath(`/events/${eventId}`, "layout");
const isUuid = (v: unknown) => z.string().uuid().safeParse(v).success;

async function load(eventId: string): Promise<EventBundle | Fail> {
  try {
    return await loadEvent(eventId);
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message === EVENT_NOT_FOUND ? "That event wasn't found." : "Couldn't load the event. Try again." };
  }
}

/**
 * Swaps a round's groups for new ones: the new groups go in first, then every current group of
 * the round is soft-removed (Undo brings them back). A failure part-way removes the new groups
 * again so the old ones stay.
 */
async function replaceGroups(eventId: string, roundId: string, drafts: DraftGroup[]): Promise<PairingsResult> {
  const supabase = await createServerSupabase();
  const now = new Date().toISOString();

  const current = await supabase.from("groups").select("id").eq("round_id", roundId).is("deleted_at", null);
  if (current.error) return SAVE_FAILED;
  const oldGroupIds = (current.data ?? []).map((g) => g.id);
  const newGroupIds = drafts.map(() => randomUUID());
  // Takes the new groups back out after a failure. If even that fails, say so rather than hide it.
  const fail = async (): Promise<Fail> => {
    const { error } = await supabase.from("groups").update({ deleted_at: now }).in("id", newGroupIds).eq("round_id", roundId);
    return error ? { ok: false, error: "That didn't save, and the half-made pairings couldn't be cleared. Reload the page and check this round." } : SAVE_FAILED;
  };

  const ins = await supabase.from("groups").insert(
    drafts.map((d, i) => ({
      id: newGroupIds[i],
      round_id: roundId,
      label: `Group ${i + 1}`,
      sort: i + 1,
      start_hole: d.startHole,
      start_time: d.startTime,
    })),
  );
  if (ins.error) return fail();
  const links = await supabase
    .from("group_teams")
    .insert(drafts.flatMap((d, i) => d.teamIds.map((teamId, j) => ({ group_id: newGroupIds[i], team_id: teamId, sort: j }))));
  if (links.error) return fail();
  if (oldGroupIds.length) {
    const del = await supabase.from("groups").update({ deleted_at: now }).in("id", oldGroupIds).eq("round_id", roundId);
    if (del.error) return fail();
  }
  refresh(eventId);
  return { ok: true, groups: drafts.length, undo: { newGroupIds, oldGroupIds } };
}

function roundOf(bundle: EventBundle, roundNumber: number) {
  return Number.isInteger(roundNumber) ? bundle.rounds.find((r) => r.number === roundNumber) : undefined;
}

/** Puts every team of the event into its own group for the round, in random order, with starts from the event settings. */
export async function makePairings(eventId: string, roundNumber: number): Promise<PairingsResult> {
  if (!(await currentStaff())) return { ok: false, error: SIGNED_OUT };
  const bundle = await load(eventId);
  if ("ok" in bundle) return bundle;
  const round = roundOf(bundle, roundNumber);
  if (!round) return { ok: false, error: "That round wasn't found." };
  if (!bundle.teams.length) return { ok: false, error: "Make teams first." };
  const alternates = new Set(bundle.entries.filter((e) => e.alternate).map((e) => e.id));
  const playing = bundle.teams.filter((t) => t.entryIds.some((id) => !alternates.has(id)));
  if (!playing.length) return { ok: false, error: "No team has players yet. Make teams first." };
  return replaceGroups(eventId, round.id, buildGroups(playing.map((t) => t.id), bundle.event.settings));
}

/** Copies round 1's groups (starts and teams) into a later round. */
export async function sameAsRound1(eventId: string, roundNumber: number): Promise<PairingsResult> {
  if (!(await currentStaff())) return { ok: false, error: SIGNED_OUT };
  const bundle = await load(eventId);
  if ("ok" in bundle) return bundle;
  const round = roundOf(bundle, roundNumber);
  const first = roundOf(bundle, 1);
  if (!round || !first || roundNumber === 1) return { ok: false, error: "That round wasn't found." };
  const source = bundle.groups.filter((g) => g.roundId === first.id).sort((a, b) => a.sort - b.sort);
  if (!source.length) return { ok: false, error: "Round 1 has no pairings yet." };
  return replaceGroups(
    eventId,
    round.id,
    source.map((g) => ({ teamIds: g.teamIds, startHole: g.startHole, startTime: g.startTime })),
  );
}

/** Reverses makePairings or sameAsRound1. */
export async function undoPairings(eventId: string, undo: PairingsUndo): Promise<{ ok: true } | Fail> {
  if (!(await currentStaff())) return { ok: false, error: SIGNED_OUT };
  const ids = z.array(z.string().uuid()).max(500);
  const parsed = z.object({ newGroupIds: ids, oldGroupIds: ids }).safeParse(undo);
  if (!parsed.success) return BAD;
  const u = parsed.data;
  const supabase = await createServerSupabase();
  const CHANGED: Fail = { ok: false, error: "The pairings changed since then, so Undo isn't available." };
  if (u.newGroupIds.length) {
    // Only undo if the round's live groups are exactly the ones Make created.
    const made = await supabase.from("groups").select("round_id").in("id", u.newGroupIds);
    if (made.error) return SAVE_FAILED;
    const roundIds = new Set((made.data ?? []).map((g) => g.round_id));
    if (roundIds.size !== 1) return CHANGED;
    const live = await supabase.from("groups").select("id").eq("round_id", [...roundIds][0]).is("deleted_at", null);
    if (live.error) return SAVE_FAILED;
    const liveIds = (live.data ?? []).map((g) => g.id);
    if (liveIds.length !== u.newGroupIds.length || !u.newGroupIds.every((id) => liveIds.includes(id))) return CHANGED;
    const { error } = await supabase.from("groups").update({ deleted_at: new Date().toISOString() }).in("id", u.newGroupIds);
    if (error) return SAVE_FAILED;
  }
  if (u.oldGroupIds.length) {
    const { error } = await supabase.from("groups").update({ deleted_at: null }).in("id", u.oldGroupIds);
    if (error) return SAVE_FAILED;
  }
  refresh(eventId);
  return { ok: true };
}

/** Moves a team into another group of the same round. A team is in at most one group per round. */
export async function moveTeam(teamId: string, toGroupId: string): Promise<{ ok: true } | Fail> {
  if (!(await currentStaff())) return { ok: false, error: SIGNED_OUT };
  if (!isUuid(teamId) || !isUuid(toGroupId)) return BAD;
  const supabase = await createServerSupabase();

  const target = await supabase.from("groups").select("id, round_id").eq("id", toGroupId).is("deleted_at", null).maybeSingle();
  if (target.error || !target.data) return { ok: false, error: "That group wasn't found. Reload the page." };
  const round = await supabase.from("rounds").select("event_id").eq("id", target.data.round_id).maybeSingle();
  if (round.error || !round.data) return SAVE_FAILED;
  const eventId = round.data.event_id;
  const team = await supabase.from("teams").select("id").eq("id", teamId).eq("event_id", eventId).is("deleted_at", null).maybeSingle();
  if (team.error || !team.data) return { ok: false, error: "That team wasn't found. Reload the page." };

  // Where the team sits now in this round (live groups only).
  const roundGroups = await supabase.from("groups").select("id").eq("round_id", target.data.round_id).is("deleted_at", null);
  if (roundGroups.error) return SAVE_FAILED;
  const links = await supabase
    .from("group_teams")
    .select("group_id")
    .eq("team_id", teamId)
    .in("group_id", (roundGroups.data ?? []).map((g) => g.id));
  if (links.error) return SAVE_FAILED;
  const from = (links.data ?? []).map((l) => l.group_id);
  const plan = planMove(from, toGroupId);
  if (plan.kind === "error") return { ok: false, error: plan.error };
  if (plan.kind === "none") return { ok: true };

  const sorts = await supabase.from("group_teams").select("sort").eq("group_id", toGroupId);
  if (sorts.error) return SAVE_FAILED;
  const sort = (sorts.data ?? []).reduce((m, r) => Math.max(m, r.sort + 1), 0);

  const res = plan.kind === "update"
    ? await supabase.from("group_teams").update({ group_id: toGroupId, sort }).eq("team_id", teamId).eq("group_id", plan.from).select("team_id")
    : await supabase.from("group_teams").insert({ group_id: toGroupId, team_id: teamId, sort }).select("team_id");
  if (res.error || !res.data?.length) return SAVE_FAILED;
  refresh(eventId);
  return { ok: true };
}


/** Changes a group's start: a hole label ("1", "10A") for shotgun events, "HH:MM" (24 hour) for tee times. */
export async function setStart(groupId: string, start: string): Promise<{ ok: true } | Fail> {
  if (!(await currentStaff())) return { ok: false, error: SIGNED_OUT };
  if (!isUuid(groupId) || typeof start !== "string") return BAD;
  const supabase = await createServerSupabase();

  const group = await supabase.from("groups").select("id, round_id").eq("id", groupId).is("deleted_at", null).maybeSingle();
  if (group.error || !group.data) return { ok: false, error: "That group wasn't found. Reload the page." };
  const round = await supabase.from("rounds").select("event_id").eq("id", group.data.round_id).maybeSingle();
  if (round.error || !round.data) return SAVE_FAILED;
  const ev = await supabase.from("events").select("settings").eq("id", round.data.event_id).maybeSingle();
  if (ev.error || !ev.data) return SAVE_FAILED;
  const settings = EventSettings.parse(ev.data.settings ?? {});

  const checked = checkStart(settings.start, start);
  if (!checked.ok) return checked;
  const patch = checked.patch;
  const { data, error } = await supabase.from("groups").update(patch).eq("id", groupId).select("id");
  if (error || !data?.length) return SAVE_FAILED;
  refresh(round.data.event_id);
  return { ok: true };
}
