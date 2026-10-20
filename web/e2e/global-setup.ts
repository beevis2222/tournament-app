import { readdirSync, rmSync, writeFileSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { execFileSync } from "node:child_process";

export const RUN_OK = join(__dirname, ".run-ok");
const webDir = join(__dirname, "..");
const { testRef: TEST_REF, productionRef: PRODUCTION_REF } = JSON.parse(readFileSync(join(__dirname, "refs.json"), "utf8"));

function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else yield p;
  }
}

/** Runs after the webServer has built and started the app, before any test. Fails loudly if anything points at production. */
export default function globalSetup() {
  rmSync(RUN_OK, { force: true }); // a flag left by an earlier killed run must not count
  const env = parseEnv(readFileSync(join(webDir, ".env.test.local"), "utf8"));
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url.includes(TEST_REF) || url.includes(PRODUCTION_REF)) {
    throw new Error("web/.env.test.local does not point at starter-test. Refusing to run.");
  }

  // The built pages carry the Supabase address. The production one must not be anywhere in them.
  let scanned = 0;
  for (const file of files(join(webDir, ".next", "static"))) {
    scanned++;
    if (readFileSync(file).includes(PRODUCTION_REF)) {
      throw new Error(`The production project address is baked into ${file}. The app was built against production. Refusing to run.`);
    }
  }
  if (scanned === 0) throw new Error("web/.next/static is empty. The app was not built.");

  // starter-test must have 0 clubs before the run (the script also refuses a CLI linked to production).
  execFileSync(process.execPath, [join(__dirname, "clean-test-db.mjs"), "check"], { stdio: "inherit" });
  // Everything checked out: tell teardown this run may clean up.
  writeFileSync(RUN_OK, "ok");
}
