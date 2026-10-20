import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { defineConfig, devices } from "@playwright/test";

// The app is built and started with web/.env.test.local (the starter-test project).
// NEXT_PUBLIC_ values are baked in at build time, so the same env is used for BOTH build and start.
const testEnv = parseEnv(readFileSync(join(__dirname, ".env.test.local"), "utf8")) as Record<string, string>;
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "outing.spec.ts",
  timeout: 5 * 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1400, height: 1000 } } }],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}/sign-in`,
    timeout: 10 * 60_000,
    reuseExistingServer: false,
    env: { ...(process.env as Record<string, string>), ...testEnv },
    stdout: "pipe",
    stderr: "pipe",
  },
});
