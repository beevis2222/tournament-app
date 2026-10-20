import { isIsoDate } from "@/lib/dates";
import { EventSettings } from "@/lib/types";

/** What the Details form holds: everything as text, so half-typed values are fine. */
export type DetailsValues = {
  name: string;
  date: string;
  rounds: string;
  holes: string;
  teamSize: string;
  teamMode: string;
  hcMethod: string;
  combinedPercent: string;
  pct4: string;
  pct3: string;
  pct2: string;
  maxTeamHandicap: string;
  cap: string;
  gap: string;
  gapMode: string;
  flights: string;
  flightNames: string[];
  start: string;
  startTime: string;
  interval: string;
  prizes: string[];
};

export type DetailsResult =
  | { ok: true; name: string; date: string; settings: EventSettings }
  | { ok: false; errors: Record<string, string> };

const NEED_NUMBER = "Enter a number.";

function num(raw: string, key: string, errors: Record<string, string>): number {
  const n = raw.trim() === "" ? NaN : Number(raw);
  if (Number.isNaN(n)) errors[key] = NEED_NUMBER;
  return n;
}

function optionalNum(raw: string, key: string, errors: Record<string, string>): number | null {
  if (raw.trim() === "") return null;
  return num(raw, key, errors);
}

/** "25, 20, 15, 10" -> [25, 20, 15, 10]; blank -> undefined. */
function percentRow(raw: string, key: string, errors: Record<string, string>): number[] | undefined {
  if (raw.trim() === "") return undefined;
  const parts = raw.split(/[,\s]+/).filter(Boolean).map(Number);
  if (parts.some(Number.isNaN)) {
    errors[key] = "Use numbers separated by commas, like 25, 20, 15, 10.";
    return undefined;
  }
  return parts;
}

/** Zod issue path -> the form field it belongs next to. */
function fieldFor(path: (string | number)[]): string {
  const [head, second] = path;
  if (head === "teamHandicap") return "teamHandicap";
  if (head === "limits") return String(second ?? "limits");
  if (head === "prizes" && typeof second === "number") return `prizes.${second}`;
  return String(head);
}

/** A plain sentence for a settings problem, whatever zod's own wording is. */
function plainMessage(path: (string | number)[], code: string): string {
  const head = String(path[0]);
  switch (head) {
    case "rounds":
      return "Rounds must be 1 to 4.";
    case "interval":
      return "Minutes between tee times must be 5 to 20.";
    case "flights":
      return "Flights must be 1 to 6.";
    case "maxTeamHandicap":
      return "Max team handicap must be 0 or more.";
    case "teamHandicap":
      return code === "invalid_union" || code === "invalid_literal" || code === "invalid_enum_value" ? "Pick a handicap method." : "Percentages must be 0 to 100.";
    case "prizes":
      return "Prizes must be 0 or more.";
    case "startTime":
      return "Pick a start time.";
    case "teamSize":
      return "Team size must be 2, 3 or 4.";
    case "limits":
      return path[1] === "gapMode" ? "Pick one of the choices." : "Enter a number or leave it blank.";
    default:
      return "Pick one of the choices.";
  }
}

export function parseDetails(v: DetailsValues): DetailsResult {
  const errors: Record<string, string> = {};
  const name = v.name.trim();
  if (!name) errors.name = "Give the event a name.";
  if (!isIsoDate(v.date)) errors.date = "Pick a date.";

  const rounds = num(v.rounds, "rounds", errors);
  const flights = num(v.flights, "flights", errors);
  const interval = num(v.interval, "interval", errors);
  const teamSize = Number(v.teamSize);
  const maxTeamHandicap = optionalNum(v.maxTeamHandicap, "maxTeamHandicap", errors);
  const cap = optionalNum(v.cap, "cap", errors);
  const gap = optionalNum(v.gap, "gap", errors);
  const prizes = v.prizes.map((p, i) => num(p, `prizes.${i}`, errors));

  let teamHandicap: unknown = { method: v.hcMethod };
  if (v.hcMethod === "combined") {
    teamHandicap = { method: "combined", percent: num(v.combinedPercent, "teamHandicap", errors) };
  } else if (v.hcMethod === "custom") {
    const percents: Record<string, number[]> = {};
    for (const size of ["4", "3", "2"] as const) {
      const row = percentRow(v[`pct${size}`], `pct${size}`, errors);
      if (row) percents[size] = row;
    }
    teamHandicap = { method: "custom", percents };
  }

  const count = Number.isNaN(flights) ? 0 : Math.max(0, flights);
  const names = v.flightNames.slice(0, count).map((n) => n.trim());
  const flightNames = names.some(Boolean) ? names.map((n, i) => n || `Flight ${i + 1}`) : [];

  const candidate = {
    holes: v.holes,
    rounds,
    teamSize,
    teamMode: v.teamMode,
    teamHandicap,
    maxTeamHandicap,
    limits: {
      ...(cap !== null ? { cap } : {}),
      ...(gap !== null ? { gap, gapMode: v.gapMode } : {}),
    },
    flights,
    flightNames,
    start: v.start,
    startTime: v.startTime,
    interval,
    prizes,
  };

  const parsed = EventSettings.safeParse(candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors[fieldFor(issue.path)] ??= plainMessage(issue.path, issue.code);
    }
  }
  if (!parsed.success || Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, name, date: v.date, settings: parsed.data };
}

export function valuesFromSettings(name: string, date: string, s: EventSettings): DetailsValues {
  const custom = s.teamHandicap.method === "custom" ? s.teamHandicap.percents : {};
  const row = (n: "2" | "3" | "4") => (custom[n] ?? []).join(", ");
  return {
    name,
    date,
    rounds: String(s.rounds),
    holes: s.holes,
    teamSize: String(s.teamSize),
    teamMode: s.teamMode,
    hcMethod: s.teamHandicap.method,
    combinedPercent: s.teamHandicap.method === "combined" ? String(s.teamHandicap.percent) : "50",
    pct4: row("4"),
    pct3: row("3"),
    pct2: row("2"),
    maxTeamHandicap: s.maxTeamHandicap === null ? "" : String(s.maxTeamHandicap),
    cap: s.limits.cap == null ? "" : String(s.limits.cap),
    gap: s.limits.gap == null ? "" : String(s.limits.gap),
    gapMode: s.limits.gapMode ?? "flag",
    flightNames: Array.from({ length: 6 }, (_, i) => s.flightNames[i] ?? ""),
    flights: String(s.flights),
    start: s.start,
    startTime: s.startTime,
    interval: String(s.interval),
    prizes: s.prizes.map(String),
  };
}
