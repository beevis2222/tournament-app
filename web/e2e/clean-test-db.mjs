// Checks and cleans the starter-test Supabase project for the end-to-end run.
//   node e2e/clean-test-db.mjs check   -> exits 1 unless starter-test has 0 clubs
//   node e2e/clean-test-db.mjs clean   -> empties every public table and removes all auth users
// Refuses to do anything unless the CLI is linked to starter-test. Never touches production.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const TEST_REF = "adotnhqartwywzkhfbkt";
export const PRODUCTION_REF = "sowukjehokbhjkjlzqio";
const webDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function assertLinkedToTest() {
  const file = join(webDir, "supabase", ".temp", "project-ref");
  const linked = existsSync(file) ? readFileSync(file, "utf8").trim() : "";
  if (linked !== TEST_REF || linked === PRODUCTION_REF) {
    throw new Error(`Refusing to run: the Supabase CLI is linked to "${linked || "nothing"}", not starter-test. Run: npx supabase link --project-ref ${TEST_REF}`);
  }
}

function query(sql) {
  const run = spawnSync(`npx supabase@latest db query --linked ${JSON.stringify(sql)}`, { cwd: webDir, shell: true, encoding: "utf8" });
  if (run.status !== 0) throw new Error(`Database command failed:\n${run.stdout}\n${run.stderr}`);
  return `${run.stdout}`;
}

export function countClubs() {
  assertLinkedToTest();
  const match = query("select count(*) as clubs from public.clubs;").match(/"clubs"\s*:\s*"?(\d+)"?/);
  if (!match) throw new Error("Could not read the club count from starter-test.");
  return Number(match[1]);
}

export function assertEmpty() {
  const n = countClubs();
  if (n !== 0) throw new Error(`starter-test has ${n} club(s). Empty it first: node e2e/clean-test-db.mjs clean`);
}

export function clean() {
  assertLinkedToTest();
  query(
    "truncate table public.score_log, public.scores, public.group_teams, public.groups, public.rounds, public.team_members, public.teams, " +
      "public.entries, public.events, public.tees, public.courses, public.golfers, public.staff, public.clubs cascade; delete from auth.users;",
  );
  assertEmpty();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const mode = process.argv[2];
  try {
    if (mode === "check") assertEmpty();
    else if (mode === "clean") clean();
    else throw new Error("Usage: node e2e/clean-test-db.mjs check|clean");
    console.log(`starter-test: ${mode} ok`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
