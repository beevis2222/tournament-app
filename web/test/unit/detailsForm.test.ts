import { describe, it, expect } from "vitest";
import { parseDetails, valuesFromSettings } from "@/lib/detailsForm";
import { EventSettings } from "@/lib/types";

const base = () => valuesFromSettings("Spring Scramble", "2026-05-02", EventSettings.parse({}));

function errorsOf(v: ReturnType<typeof base>) {
  const r = parseDetails(v);
  if (r.ok) throw new Error("expected errors");
  return r.errors;
}

describe("parseDetails", () => {
  it("round-trips default settings", () => {
    const r = parseDetails(base());
    expect(r).toMatchObject({ ok: true, name: "Spring Scramble" });
    if (r.ok) expect(r.settings).toEqual(EventSettings.parse({}));
  });
  it("shows the Zod message next to the field", () => {
    expect(errorsOf({ ...base(), rounds: "9" }).rounds).toMatch(/less than or equal to 4/);
  });
  it("flags blank numbers and a missing name", () => {
    const e = errorsOf({ ...base(), name: " ", interval: "" });
    expect(e.name).toBeDefined();
    expect(e.interval).toBe("Enter a number.");
  });
  it("reads custom percent rows", () => {
    const r = parseDetails({ ...base(), hcMethod: "custom", pct4: "25, 20, 15, 10", pct3: "", pct2: "35 15" });
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(r.settings.teamHandicap).toEqual({ method: "custom", percents: { "4": [25, 20, 15, 10], "2": [35, 15] } });
  });
  it("rejects bad percent text and out-of-range percents", () => {
    expect(errorsOf({ ...base(), hcMethod: "custom", pct4: "a, b" }).pct4).toBeDefined();
    expect(errorsOf({ ...base(), hcMethod: "combined", combinedPercent: "150" }).teamHandicap).toBeDefined();
  });
  it("supports gross only, limits, prizes and flight names", () => {
    const r = parseDetails({
      ...base(),
      hcMethod: "none",
      maxTeamHandicap: "6",
      cap: "30",
      gap: "12",
      gapMode: "reduce",
      flights: "2",
      flightNames: ["Low", "", "", "", "", ""],
      prizes: ["150", "100"],
    });
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(r.settings).toMatchObject({
      teamHandicap: { method: "none" },
      maxTeamHandicap: 6,
      limits: { cap: 30, gap: 12, gapMode: "reduce" },
      flights: 2,
      flightNames: ["Low", "Flight 2"],
      prizes: [150, 100],
    });
  });
  it("puts a bad prize on its own row", () => {
    expect(errorsOf({ ...base(), prizes: ["150", "-5"] })["prizes.1"]).toBeDefined();
  });
});
