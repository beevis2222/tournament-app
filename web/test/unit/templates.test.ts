import { describe, it, expect } from "vitest";
import { TEMPLATES } from "@/lib/templates";
import { EventSettings } from "@/lib/types";

describe("TEMPLATES", () => {
  it("every available template has valid settings", () => {
    for (const t of TEMPLATES.filter((x) => x.available)) {
      expect(() => EventSettings.parse(t.settings), t.name).not.toThrow();
    }
  });
  it("exactly two are available", () => {
    expect(TEMPLATES.filter((t) => t.available).map((t) => t.name)).toEqual(["Charity outing", "Blank scramble"]);
  });
  it("names match the prototype's built-in templates", () => {
    const names = TEMPLATES.map((t) => t.name);
    for (const n of ["Club championship", "Match play championship", "Member-member", "Member-guest", "Charity outing", "Weekly skins game", "Stableford day"]) {
      expect(names).toContain(n);
    }
    expect(names).toContain("Blank scramble");
    expect(names).toHaveLength(8);
  });
  it("Charity outing is a 4-person gross shotgun at 1:00 pm", () => {
    const s = EventSettings.parse(TEMPLATES.find((t) => t.name === "Charity outing")!.settings);
    expect(s).toMatchObject({ teamSize: 4, start: "shotgun", startTime: "13:00", rounds: 1, flights: 1, teamHandicap: { method: "none" } });
  });
});
