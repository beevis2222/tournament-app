import { readBackup } from "@/lib/backup";
import { importBundles, scoreProblem, type ImportStore } from "@/lib/importRun";

const pars = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5];
const proto = (name: string, score = 4) => ({
  id: "x",
  event: { name, format: "scramble", scoring: "net", rounds: 1, teamSize: 2, holesMode: "18", rmode: {}, start: "shotgun", pars, si: pars.map((_, i) => i + 1), tees: [{ id: "b", name: "Blue", rating: 68, slope: 120 }] },
  players: ["A One", "B Two"].map((n, i) => ({ id: `p${i}`, name: `${name} ${n}`, index: 10, tee: "b" })),
  pairings: { teams: [{ id: "t0", players: ["p0", "p1"], label: "A" }], rounds: [[{ id: "g", teams: ["t0"], start: "1" }]] },
  cards: [{ t0: { team: [4, score] } }],
});
const bundles = (...evs: unknown[]) => readBackup(JSON.stringify({ kind: "starter-backup", version: 1, events: evs })).bundles;

function fake(failOn?: (table: string, rows: { id?: string }[]) => boolean) {
  const calls = { inserts: [] as [string, { id?: string }[]][], deletes: [] as [string, string[]][] };
  const store: ImportStore = {
    insert: async (table, rows) => {
      calls.inserts.push([table, rows as { id?: string }[]]);
      return { error: failOn?.(table, rows as { id?: string }[]) ? { message: "x" } : null };
    },
    softDelete: async (table, ids) => {
      calls.deletes.push([table, ids]);
      return { error: null };
    },
  };
  return { store, calls };
}

test("a failure mid-way hides exactly what was inserted; the next event still imports", async () => {
  const [a, b] = bundles(proto("Alpha"), proto("Beta"));
  const { store, calls } = fake((table, rows) => table === "teams" && rows[0].id === a.teams[0].id);
  const r = await importBundles(store, [a, b], "club", [], []);
  expect(r.imported).toEqual(["Beta"]);
  expect(r.failed).toEqual(["Couldn't import Alpha."]);
  const gone = Object.fromEntries(calls.deletes.map(([t, ids]) => [t, ids]));
  expect(gone.events).toEqual([a.event.id]);
  expect(gone.entries).toEqual(a.entries.map((e) => e.id));
  expect(gone.courses).toEqual([a.course.id]);
  expect(gone.teams).toEqual(a.teams.map((t) => t.id)); // the failed step is covered too
  expect(gone.groups).toBeUndefined(); // never reached
  const everyDeleted = calls.deletes.flatMap(([, ids]) => ids);
  expect(everyDeleted).not.toContain(b.event.id);
  expect(calls.inserts.filter(([t]) => t === "events").map(([, rows]) => rows[0].id)).toEqual([a.event.id, b.event.id]);
});

test("if hiding the event fails, the message says a partial copy may remain", async () => {
  const [a] = bundles(proto("Alpha"));
  const { store } = fake((table) => table === "scores");
  store.softDelete = async () => ({ error: { message: "no" } });
  const r = await importBundles(store, [a], "club", [], []);
  expect(r.failed).toEqual(["Couldn't import Alpha; a partial copy may remain."]);
});

test("an out-of-range score fails that event with its hole, before anything is inserted", async () => {
  const [bad, ok] = bundles(proto("Bad", 25), proto("Good"));
  expect(scoreProblem(bad)).toBe("Couldn't import Bad: a score was out of range (hole 2).");
  const { store, calls } = fake();
  const r = await importBundles(store, [bad, ok], "club", [], []);
  expect(r.failed).toEqual(["Couldn't import Bad: a score was out of range (hole 2)."]);
  expect(r.imported).toEqual(["Good"]);
  expect(calls.deletes).toEqual([]);
});

test("a throw while planning one event does not lose the others", async () => {
  const [a, b] = bundles(proto("Alpha"), proto("Beta"));
  a.event.settings = { rounds: "many" } as never; // makes EventSettings.parse throw
  const { store } = fake();
  const r = await importBundles(store, [a, b], "club", [], []);
  expect(r.imported).toEqual(["Beta"]);
  expect(r.failed).toEqual(["Couldn't import Alpha."]);
});
