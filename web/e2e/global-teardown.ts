import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

/** Puts starter-test back to empty, but only if setup passed all its checks (otherwise the data is not ours to delete). */
export default function globalTeardown() {
  const flag = join(__dirname, ".run-ok");
  if (!existsSync(flag)) return;
  rmSync(flag);
  execFileSync(process.execPath, [join(__dirname, "clean-test-db.mjs"), "clean"], { stdio: "inherit" });
}
