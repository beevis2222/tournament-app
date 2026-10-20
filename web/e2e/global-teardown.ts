import { execFileSync } from "node:child_process";
import { join } from "node:path";

/** Puts starter-test back to empty (all public rows and auth users), pass or fail. */
export default function globalTeardown() {
  execFileSync(process.execPath, [join(__dirname, "clean-test-db.mjs"), "clean"], { stdio: "inherit" });
}
