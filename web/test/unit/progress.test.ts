import { describe, it, expect } from "vitest";
import { progressSteps, eventSubtitle } from "@/lib/progress";
import { EventSettings, type EventBundle } from "@/lib/types";

const bundle = (over: Partial<EventBundle> = {}, settings: object = {}): EventBundle => ({
  event: { id: "e1", name: "Spring", date: "2026-05-02", status: "setup", settings: EventSettings.parse(settings) },
  course: { id: "c1", name: "Main", pars: Array(18).fill(4), si: Array.from({ length: 18 }, (_, i) => i + 1) },
  tees: [], entries: [], teams: [], rounds: [{ id: "r1", number: 1, mode: "full" }], groups: [], scores: [],
  ...over,
});

describe("progressSteps", () => {
  it("lists the six steps in order, links first", () => {
    const steps = progressSteps(bundle());
    expect(steps.map((s) => s.label)).toEqual(["Details", "Field", "Teams", "Pairings", "Scores", "Finish"]);
    expect(steps[0].href).toBe("/events/e1/details");
    expect(steps.map((s) => s.done)).toEqual([true, false, false, false, false, false]);
  });
  it("Details is not done until a course is chosen", () => {
    expect(progressSteps(bundle({ course: { id: "", name: "", pars: [], si: [] } }))[0].done).toBe(false);
  });
  it("marks scores done when every team has every hole", () => {
    const team = { id: "t1", label: "T1", flight: null, status: null, sort: 0, entryIds: ["p1"] };
    const entries = [{ id: "p1", golferId: "g1", name: "Pat", indexUsed: 5, nh: false, teeId: null, alternate: false }];
    const scores = Array.from({ length: 18 }, (_, i) => ({ roundId: "r1", teamId: "t1", hole: i + 1, gross: 4 }));
    const b = bundle({ teams: [team], entries, scores });
    expect(progressSteps(b)[4].done).toBe(true);
    expect(progressSteps({ ...b, scores: scores.slice(1) })[4].done).toBe(false);
  });
  it("counts each round's own holes: a front-nine round is done with nine scores; called-off rounds do not count", () => {
    const team = { id: "t1", label: "T1", flight: null, status: null, sort: 0, entryIds: ["p1"] };
    const entries = [{ id: "p1", golferId: "g1", name: "Pat", indexUsed: 5, nh: false, teeId: null, alternate: false }];
    const front = Array.from({ length: 9 }, (_, i) => ({ roundId: "r1", teamId: "t1", hole: i + 1, gross: 4 }));
    const rounds = [{ id: "r1", number: 1, mode: "front" as const }, { id: "r2", number: 2, mode: "called_off" as const }];
    const b = bundle({ teams: [team], entries, scores: front, rounds }, { rounds: 2 });
    expect(progressSteps(b)[4].done).toBe(true);
    expect(progressSteps({ ...b, scores: front.slice(1) })[4].done).toBe(false);
    // the back nine of a back-nine round is holes 10-18
    const back = Array.from({ length: 9 }, (_, i) => ({ roundId: "r1", teamId: "t1", hole: i + 10, gross: 4 }));
    expect(progressSteps({ ...b, rounds: [{ id: "r1", number: 1, mode: "back" }], scores: back })[4].done).toBe(true);
  });
});

describe("eventSubtitle", () => {
  it("describes the event", () => {
    expect(eventSubtitle(bundle({}, { start: "shotgun", startTime: "13:00" }))).toBe("4-person scramble, shotgun at 1:00 pm");
    expect(eventSubtitle(bundle({}, { rounds: 2, flights: 2, teamHandicap: { method: "none" }, startTime: "08:00", start: "teetimes" })))
      .toBe("36-hole 4-person gross scramble, 2 flights, tee times from 8:00 am");
  });
});
