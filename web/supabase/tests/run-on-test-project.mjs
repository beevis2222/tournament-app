// Runs schema.test.sql on the starter-test project without Docker.
//   cd web && node supabase/tests/run-on-test-project.mjs
// Needs only `npx supabase login`. Uses no passwords or keys.
//
// How it works: `supabase db query` returns just one result, so this makes a temporary copy of
// the test file that stores each pgTAP line in a temp table and ends with an exception carrying
// the output. The exception rolls the whole transaction back, so nothing is left behind.
// It always targets starter-test by ref and refuses production.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// The two project refs live in one place, shared with the end-to-end test.
const refs = JSON.parse(readFileSync(join(here, "..", "..", "e2e", "refs.json"), "utf8"));
const TEST_REF = refs.testRef;
const PRODUCTION_REF = refs.productionRef;
const ref = process.argv[2] ?? TEST_REF;
const webDir = join(here, "..", "..");
const linkedRefFile = join(webDir, "supabase", ".temp", "project-ref");
const linkedRef = existsSync(linkedRefFile) ? readFileSync(linkedRefFile, "utf8").trim() : "";
if (!/^[a-z]{20}$/.test(ref) || ref === PRODUCTION_REF || linkedRef === PRODUCTION_REF) {
  console.error(
    "Refusing to run: the tests only run on starter-test. If the CLI is linked to production, relink first:\n" +
      `  npx supabase link --project-ref ${TEST_REF}`,
  );
  process.exit(1);
}
const sql = readFileSync(join(here, "schema.test.sql"), "utf8")
  .replace(/^select ((plan|ok|is|lives_ok|throws_ok|results_eq)\(|\* from finish)/gm, "insert into _tap(line) select $1")
  .replace(
    /^(create extension if not exists pgtap.*)$/m,
    "$1\ncreate temp table _tap (at timestamptz default clock_timestamp(), line text);\ngrant all on _tap to public;",
  )
  .replace(
    /^rollback;\r?$/m,
    "do $x$ begin raise exception E'TAP OUTPUT (rolled back)\\n%', (select string_agg(line, E'\\n' order by at) from _tap); end $x$;",
  );

const dir = mkdtempSync(join(tmpdir(), "starter-pgtap-"));
const file = join(dir, "wrapped.test.sql");
writeFileSync(file, sql);

const run = spawnSync(`npx supabase db query --linked --project-ref ${ref} -f "${file}"`, {
  cwd: webDir,
  shell: true,
  encoding: "utf8",
});
rmSync(dir, { recursive: true, force: true });

const output = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
const jsonStart = output.indexOf("{");
let message = "";
try {
  const cliMessage = JSON.parse(output.slice(jsonStart, output.lastIndexOf("}") + 1)).error?.message ?? "";
  // The CLI wraps the database's JSON reply: unexpected status 400: {"message":"...ERROR: ..."}
  message = JSON.parse(cliMessage.slice(cliMessage.indexOf("{"))).message ?? "";
} catch {
  // fall through: print the raw output below
}
const marker = "TAP OUTPUT (rolled back)\n";
const at = message.indexOf(marker);
if (at < 0) {
  console.error("The test file did not finish (everything was rolled back). CLI output:\n" + output);
  process.exit(1);
}
const tap = message
  .slice(at + marker.length)
  .split("\nCONTEXT:")[0]
  .split("\n");
console.log(tap.join("\n"));

const planned = Number(/^1\.\.(\d+)$/.exec(tap[0] ?? "")?.[1] ?? NaN);
const passed = tap.filter((line) => /^ok \d+/.test(line)).length;
const failed = tap.some((line) => /^not ok/.test(line) || /^# Looks like/.test(line));
if (failed || passed !== planned) {
  console.error(`\nFAILED: ${passed} of ${planned} passed`);
  process.exit(1);
}
console.log(`\nAll ${planned} checks passed on ${ref} (rolled back).`);
