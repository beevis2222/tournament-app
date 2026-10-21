// One whole charity outing, start to finish, in a real browser against the starter-test project.
// Expected standings and prizes are worked out here with the scoring engine from the same data.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  payoutAmounts,
  scrambleBoards,
  scrambleFlights,
  scrambleLeaderboard,
  scrambleTeamHandicap,
  type Player,
  type ScrambleEvent,
  type Team,
} from "@starter/scoring";

// Pars and stroke index from scoring/test/scramble.test.ts. Rating 72.0 / slope 113 on par 72.
const PARS = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 3, 4, 5, 4, 4, 3, 5, 4];
const SI = [7, 11, 15, 1, 5, 13, 17, 9, 3, 8, 16, 4, 2, 12, 10, 18, 6, 14];
const TEE = { id: "white", name: "White", rating: 72, slope: 113 };

/** Fixed gross score for team number `t` (1 to 8) on hole `h` (0 to 17): par plus -1 to +2. */
const grossFor = (t: number, h: number) => PARS[h] + ((h * (t + 2) + 3 * t) % 4) - 1;

const money = (n: number) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);
const toParText = (n: number | null) => (n === null ? "" : n === 0 ? "E" : n > 0 ? `+${n}` : String(n));

type CsvPlayer = { name: string; index: number };
/** players.csv: "+1.2" is a plus handicap, index -1.2. */
function readPlayers(): CsvPlayer[] {
  return readFileSync(join(__dirname, "players.csv"), "utf8")
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => {
      const [name, idx] = line.split(",");
      return { name, index: idx.startsWith("+") ? -Number(idx.slice(1)) : Number(idx) };
    });
}

type ScrapedTeam = { label: string; handicap: number; flight: number; players: string[] };

async function scrapeTeams(page: Page, base: string): Promise<ScrapedTeam[]> {
  await page.goto(`${base}/teams`);
  await expect(page.locator(".tee-card").first()).toBeVisible();
  const raw = await page.locator(".tee-card").evaluateAll((cards) =>
    cards.map((c) => ({
      label: c.querySelector("strong")!.textContent!.trim(),
      info: c.querySelector(".muted")!.textContent!,
      players: [...c.querySelectorAll('select[aria-label^="Move "]')].map((s) => s.getAttribute("aria-label")!.slice(5)),
    })),
  );
  return raw.map((r) => {
    const hc = r.info.match(/Team handicap (\d+)/);
    const fl = r.info.match(/· ([A-F]) Flight/);
    if (!hc || !fl) throw new Error(`${r.label} has no handicap or flight on the Teams page: ${r.info}`);
    return { label: r.label, handicap: Number(hc[1]), flight: fl[1].charCodeAt(0) - 65, players: r.players };
  });
}

type Row = { pos: string; team: string; toPar: string; prize: string };

/** Reads every board (or winners) table on the page: flight name -> [gross rows, net rows]. */
async function scrapeBoards(page: Page): Promise<Record<string, Row[][]>> {
  return page.locator("section").evaluateAll((sections) => {
    const out: Record<string, Row[][]> = {};
    for (const s of sections) {
      const name = s.querySelector("h2, h3")?.textContent?.trim() ?? "";
      out[name] = [...s.querySelectorAll(".boards > div")].map((box) =>
        [...box.querySelectorAll("tbody tr")].map((tr) => {
          const tds = tr.querySelectorAll("td");
          const isPrize = tds[2]?.classList.contains("prize") ?? false;
          return {
            pos: tds[0].textContent!.trim(),
            team: tds[1].childNodes[0].textContent!.trim(),
            toPar: isPrize ? "" : (tds[2]?.textContent ?? "").trim(),
            prize: isPrize ? tds[2].textContent!.trim() : "",
          };
        }),
      );
    }
    return out;
  });
}

test("a whole charity outing, from sign-up to prizes and print sheets", async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e+${stamp}@example.test`;
  const password = `pw-${stamp}-${Math.random().toString(36).slice(2)}`;
  const csvPlayers = readPlayers();
  expect(csvPlayers).toHaveLength(32);

  // ---- Sign up, set up the club ----
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole("button", { name: "Create password" }).click();
  await expect(page.getByRole("heading", { name: "Set up your club" })).toBeVisible();
  await page.getByLabel("Club name").fill("Example Test Club");
  await page.getByRole("button", { name: "Create club" }).click();

  // ---- New event from Charity outing ----
  await expect(page.getByRole("heading", { name: "Start a new event" })).toBeVisible();
  await page.getByRole("button", { name: /Charity outing/ }).click();
  await page.waitForURL(/\/events\/[0-9a-f-]{36}\/details/);
  const base = page.url().replace(/\/details$/, "");

  // ---- Details: USGA handicaps, 2 flights ----
  await page.getByLabel("Team handicap method").selectOption("usga");
  await page.getByLabel("Number of flights").fill("2");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  const prizes: number[] = [];
  for (let i = 1; ; i++) {
    const box = page.getByLabel(`Place ${i} ($)`);
    if (!(await box.count())) break;
    prizes.push(Number(await box.inputValue()));
  }
  expect(prizes.length).toBeGreaterThan(0);

  // ---- Course ----
  await page.goto(`${base}/course`);
  await page.getByLabel("Course for this event").selectOption("new");
  await page.getByLabel("Course name").fill("Example Hills");
  for (let h = 0; h < 18; h++) {
    await page.locator(`#course-par-${h}`).fill(String(PARS[h]));
    await page.locator(`#course-si-${h}`).fill(String(SI[h]));
  }
  await page.getByRole("button", { name: "Save course" }).click();
  await expect(page.getByText("Course saved.")).toBeVisible();
  const addTee = page.getByRole("form", { name: "Add a tee" });
  await addTee.getByLabel("Tee name").fill(TEE.name);
  await addTee.getByLabel("Course rating").fill(String(TEE.rating));
  await addTee.getByLabel("Slope").fill(String(TEE.slope));
  await addTee.getByRole("button", { name: "Add tee" }).click();
  await expect(page.getByText("Tee added.")).toBeVisible();

  // ---- Field: import players.csv ----
  await page.goto(`${base}/field`);
  await page.locator('input[type="file"]').setInputFiles(join(__dirname, "players.csv"));
  await expect(page.getByRole("heading", { name: "32 players ready" })).toBeVisible();
  await page.getByRole("button", { name: "Add to field" }).click();
  await expect(page.getByText("Added 32 players.").first()).toBeVisible();

  // ---- Teams: balanced, then 2 flights ----
  await page.goto(`${base}/teams`);
  await page.getByRole("button", { name: "Make balanced teams" }).click();
  await expect(page.getByText("Made 8 teams.").first()).toBeVisible();
  await page.getByRole("button", { name: "Split into flights" }).click();
  await expect(page.getByText("Split into 2 flights.")).toBeVisible();

  // ---- Build the engine's view of the same event ----
  const scraped = await scrapeTeams(page, base);
  expect(scraped).toHaveLength(8);
  const byName = new Map(csvPlayers.map((p) => [p.name, p]));
  const players: Player[] = csvPlayers.map((p) => ({ id: p.name, name: p.name, index: p.index }));
  const teams: Team[] = scraped.map((t) => {
    for (const n of t.players) expect(byName.has(n), `${n} is from the CSV`).toBe(true);
    return { id: t.label, name: t.label, playerIds: t.players, flight: t.flight };
  });
  const cards = Object.fromEntries(
    teams.map((t) => [t.id, Array.from({ length: 18 }, (_, h) => grossFor(Number(t.id.replace("Team ", "")), h))]),
  );
  const ev: ScrambleEvent = {
    teamHandicap: { method: "usga" },
    course: { pars: PARS, si: SI, tees: [TEE] },
    players,
    teams,
    holes: "18",
    rounds: ["full"],
    scores: [cards],
  };
  // The handicaps shown are the engine's, and the flights follow the engine's split by handicap.
  scraped.forEach((s, i) => expect(s.handicap, `${s.label} handicap`).toBe(scrambleTeamHandicap(ev, teams[i])));
  const engineFlights = scrambleFlights(ev, 2);
  teams.forEach((t) => expect(t.flight, `${t.id} flight`).toBe(engineFlights.findIndex((f) => f.includes(t.id))));

  // ---- Pairings and the pre-event check ----
  await page.goto(`${base}/pairings`);
  await page.getByRole("button", { name: "Make pairings" }).click();
  await expect(page.getByText("Made 8 groups for round 1.").first()).toBeVisible();
  await expect(page.getByText("Ready to play")).toBeVisible();

  // ---- Cards: all 8 teams ----
  await page.goto(`${base}/cards`);
  // A second page reads what the server has kept (saves are queued one at a time, about a second each).
  const check = await page.context().newPage();
  await check.goto(`${base}/cards`);
  for (let n = 1; n <= 8; n++) {
    await page.locator('ul[aria-label="Teams"]').getByRole("button", { name: new RegExp(`^Team ${n}\\b`) }).click();
    for (let h = 0; h < 18; h++) {
      const box = page.getByLabel(`Hole ${h + 1} score`);
      await box.fill(String(grossFor(n, h)));
      await box.press("Enter");
    }
    await expect(page.locator(".save-failed")).toHaveCount(0);
    await expect(async () => {
      await check.reload();
      await expect(check.locator('ul[aria-label="Teams"]').getByRole("button", { name: new RegExp(`^Team ${n} thru 18$`) })).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 120_000, intervals: [2000] });
  }
  await check.close();

  // ---- Board matches the engine ----
  const kinds = scrambleBoards(ev);
  expect(kinds).toEqual(["gross", "net"]);
  const flightNames = ["A Flight", "B Flight"];
  const flightTeams = (f: number) => teams.filter((t) => t.flight === f);

  await page.goto(`${base}/board`);
  await expect(page.getByRole("heading", { name: "A Flight" })).toBeVisible();
  const board = await scrapeBoards(page);
  flightNames.forEach((name, f) =>
    kinds.forEach((kind, k) => {
      const expected = scrambleLeaderboard(ev, kind, flightTeams(f)).map((r) => ({ pos: r.label, team: r.total.team.name, toPar: toParText(r.toPar) }));
      expect(board[name][k].map(({ pos, team, toPar }) => ({ pos, team, toPar })), `${name} ${kind} board`).toEqual(expected);
    }),
  );

  // ---- Finish shows the engine's prizes ----
  await page.goto(`${base}/finish`);
  await expect(page.getByRole("heading", { name: "Prize winners" })).toBeVisible();
  const winners = await scrapeBoards(page);
  flightNames.forEach((name, f) =>
    kinds.forEach((kind, k) => {
      const lb = scrambleLeaderboard(ev, kind, flightTeams(f));
      const pay = payoutAmounts(lb.map((r) => ({ id: r.total.team.id, position: r.position, eligible: r.eligible })), prizes);
      const expected = lb
        .filter((r) => pay.has(r.total.team.id))
        .map((r) => ({ pos: r.label, team: r.total.team.name, prize: money(pay.get(r.total.team.id)!) }));
      expect(winners[name][k].map(({ pos, team, prize }) => ({ pos, team, prize })), `${name} ${kind} prizes`).toEqual(expected);
    }),
  );

  // ---- The 6 print pages load with the teams on them ----
  const labels = teams.map((t) => t.name);
  for (const slug of ["pairings", "cards", "cart-signs", "starter", "results"]) {
    const res = await page.goto(`${base}/print/${slug}`);
    expect(res?.status(), slug).toBe(200);
    const text = await page.locator("main").innerText();
    for (const label of labels) expect(text, `${slug} shows ${label}`).toMatch(new RegExp(`\\b${label}\\b`));
  }
  // The alpha list is by player ("Last, First"), not by team: every player must be on it.
  const alpha = await page.goto(`${base}/print/alpha`);
  expect(alpha?.status()).toBe(200);
  const alphaText = await page.locator("main").innerText();
  for (const p of csvPlayers) {
    const [first, last] = p.name.split(" ");
    expect(alphaText, `alpha list shows ${p.name}`).toContain(`${last}, ${first}`);
  }
});
