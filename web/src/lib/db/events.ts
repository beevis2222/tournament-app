import { fetchAll } from "@/lib/db/paging";
import { createServerSupabase } from "@/lib/supabase/server";
import { EventSettings, type EventBundle } from "@/lib/types";

export const EVENT_NOT_FOUND = "Event not found";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Couldn't load ${what}`);
  return res.data;
}

function rows<T>(res: { data: T[] | null; error: { message: string } | null }, what: string): T[] {
  return check(res, what) ?? [];
}

/** Shown on Details until a course is chosen. Its id is "" so screens can tell (use hasCourse). */
export const NO_COURSE: EventBundle["course"] = {
  id: "",
  name: "",
  pars: Array(18).fill(4),
  si: Array.from({ length: 18 }, (_, i) => i + 1),
};

/**
 * Loads everything the screens and the engine need for one event.
 * Removed rows (deleted_at set) are left out. Throws Error("Event not found") when missing.
 * Rounds above settings.rounds are left out too (they are kept in the database so
 * raising the number again brings back their scores).
 */
export async function loadEvent(id: string): Promise<EventBundle> {
  if (!UUID.test(id)) throw new Error(EVENT_NOT_FOUND);
  const supabase = await createServerSupabase();

  const ev = check(
    await supabase
      .from("events")
      .select("id, name, date, status, course_id, settings")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    "the event",
  );
  if (!ev) throw new Error(EVENT_NOT_FOUND);
  const settings = EventSettings.parse(ev.settings ?? {});

  const [courseRes, teesRes, roundsRes, entriesRes, teamsRes] = await Promise.all([
    ev.course_id
      ? supabase.from("courses").select("id, name, pars, si").eq("id", ev.course_id).is("deleted_at", null).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    ev.course_id
      ? supabase.from("tees").select("id, name, rating, slope, pars, si, created_at").eq("course_id", ev.course_id).order("created_at")
      : Promise.resolve({ data: [], error: null }),
    supabase.from("rounds").select("id, number, mode").eq("event_id", id).lte("number", settings.rounds).order("number"),
    fetchAll((from, to) =>
      supabase
        .from("entries")
        .select("id, golfer_id, index_used, nh, tee_id, alternate, created_at, golfers(name)")
        .eq("event_id", id)
        .is("deleted_at", null)
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("teams")
        .select("id, label, flight, status, sort")
        .eq("event_id", id)
        .is("deleted_at", null)
        .order("sort")
        .order("id")
        .range(from, to),
    ),
  ]);
  const course = check(courseRes, "the course");
  const tees = rows(teesRes, "the tees");
  const rounds = rows(roundsRes, "the rounds");
  const entries = rows(entriesRes, "the field");
  const teams = rows(teamsRes, "the teams");

  const roundIds = rounds.map((r) => r.id);
  const teamIds = teams.map((t) => t.id);
  const [membersRes, groupsRes, scoresRes] = await Promise.all([
    teamIds.length
      ? fetchAll((from, to) =>
          supabase.from("team_members").select("team_id, entry_id, sort").in("team_id", teamIds).order("sort").order("entry_id").range(from, to),
        )
      : Promise.resolve({ data: [], error: null }),
    roundIds.length
      ? fetchAll((from, to) =>
          supabase
            .from("groups")
            .select("id, round_id, start_hole, start_time, label, sort")
            .in("round_id", roundIds)
            .is("deleted_at", null)
            .order("sort")
            .order("id")
            .range(from, to),
        )
      : Promise.resolve({ data: [], error: null }),
    roundIds.length
      ? fetchAll((from, to) =>
          supabase
            .from("scores")
            .select("id, round_id, team_id, hole, gross")
            .in("round_id", roundIds)
            .not("team_id", "is", null)
            .order("id")
            .range(from, to),
        )
      : Promise.resolve({ data: [], error: null }),
  ]);
  const members = rows(membersRes, "the teams");
  const groups = rows(groupsRes, "the pairings");
  const scores = rows(scoresRes, "the scores");

  const groupIds = groups.map((g) => g.id);
  const groupTeams = groupIds.length
    ? rows(
        await fetchAll((from, to) =>
          supabase.from("group_teams").select("group_id, team_id, sort").in("group_id", groupIds).order("sort").order("team_id").range(from, to),
        ),
        "the pairings",
      )
    : [];

  const entryIds = new Set(entries.map((e) => e.id));
  const entryById = new Map(entries.map((e) => [e.id, e]));
  // A team with nobody playing counts as not there, so groups never list it.
  const teamIdSet = new Set(
    teams
      .filter((t) => members.some((m) => m.team_id === t.id && entryById.has(m.entry_id) && !entryById.get(m.entry_id)!.alternate))
      .map((t) => t.id),
  );

  return {
    event: { id: ev.id, name: ev.name, date: ev.date, status: ev.status as EventBundle["event"]["status"], settings },
    course: course ?? NO_COURSE,
    tees: tees.map((t) => ({ id: t.id, name: t.name, rating: Number(t.rating), slope: t.slope, pars: t.pars, si: t.si })),
    entries: entries.map((e) => ({
      id: e.id,
      golferId: e.golfer_id,
      name: (Array.isArray(e.golfers) ? e.golfers[0]?.name : e.golfers?.name) ?? "",
      indexUsed: Number(e.index_used),
      nh: e.nh,
      teeId: e.tee_id,
      alternate: e.alternate,
    })),
    teams: teams.map((t) => ({
      id: t.id,
      label: t.label,
      flight: t.flight,
      status: t.status as EventBundle["teams"][number]["status"],
      sort: t.sort,
      entryIds: members.filter((m) => m.team_id === t.id && entryIds.has(m.entry_id)).map((m) => m.entry_id),
    })),
    rounds: rounds.map((r) => ({ id: r.id, number: r.number, mode: r.mode as EventBundle["rounds"][number]["mode"] })),
    // Groups with no team left in them (everyone moved out, or the teams were removed) are left out.
    groups: groups
      .map((g) => ({
        id: g.id,
        roundId: g.round_id,
        startHole: g.start_hole,
        startTime: g.start_time,
        label: g.label,
        sort: g.sort,
        teamIds: groupTeams.filter((gt) => gt.group_id === g.id && teamIdSet.has(gt.team_id)).map((gt) => gt.team_id),
      }))
      .filter((g) => g.teamIds.length > 0),
    scores: scores.map((s) => ({ roundId: s.round_id, teamId: s.team_id as string, hole: s.hole, gross: s.gross })),
  };
}
