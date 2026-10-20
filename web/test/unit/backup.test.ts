import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fromPrototypeScramble, scrambleRound, scrambleTeamHandicap } from "@starter/scoring";
import { readBackup } from "@/lib/backup";
import { toEngine } from "@/lib/toEngine";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../scoring/test/fixtures/scramble-parity.json", import.meta.url)), "utf8"),
) as { cases: { event: any }[] };

const wrap = (events: unknown[]) => JSON.stringify({ kind: "starter-backup", version: 1, events });

test("importing all 400 prototype scrambles scores identically to the engine's own reader", () => {
  expect(fixture.cases).toHaveLength(400);
  for (const [i, c] of fixture.cases.entries()) {
    const result = readBackup(wrap([c.event]));
    expect(result.skipped).toEqual([]);
    const got = toEngine(result.bundles[0]);
    const want = fromPrototypeScramble(c.event);
    expect(got.teams.length, `case ${i} team count`).toBe(want.teams.length);
    for (const wt of want.teams) {
      const gt = got.teams.find((t) => t.name === wt.name)!;
      expect(gt, `case ${i} team ${wt.name}`).toBeDefined();
      expect(scrambleTeamHandicap(got, gt), `case ${i} ${wt.name} handicap`).toBe(scrambleTeamHandicap(want, wt));
      for (let r = 0; r < want.rounds.length; r++) {
        const a = scrambleRound(got, gt, r);
        const b = scrambleRound(want, wt, r);
        expect(a, `case ${i} ${wt.name} round ${r}`).toEqual(b);
      }
    }
  }
});

test("a file that is not a backup is refused with a plain message", () => {
  expect(() => readBackup("{}")).toThrow("That file isn't a backup from this app.");
  expect(() => readBackup("not json")).toThrow("That file isn't a backup from this app.");
});

test("non-scramble events are skipped with a reason", () => {
  const r = readBackup(wrap([{ id: "m", event: { name: "Cup", format: "matchplay" } }]));
  expect(r.bundles).toHaveLength(0);
  expect(r.skipped).toEqual([{ name: "Cup", reason: "matchplay isn't supported yet" }]);
});
