import { describe, expect, it } from "vitest";
import { holesInPlay, scrambleRound } from "@starter/scoring";
import { liveEvent, parseGross, sumHoles } from "@/lib/cardEntry";
import type { ScrambleEvent } from "@starter/scoring";

describe("parseGross", () => {
  it("accepts whole numbers 1 to 20", () => {
    expect(parseGross("1")).toEqual({ kind: "value", value: 1 });
    expect(parseGross(" 20 ")).toEqual({ kind: "value", value: 20 });
    expect(parseGross("07")).toEqual({ kind: "value", value: 7 });
  });
  it("treats blank as a clear", () => {
    expect(parseGross("")).toEqual({ kind: "empty" });
    expect(parseGross("   ")).toEqual({ kind: "empty" });
  });
  it("rejects everything else", () => {
    for (const bad of ["0", "21", "-3", "4.5", "abc", "4a", "1e1"]) expect(parseGross(bad)).toEqual({ kind: "invalid" });
  });
});

const pars = [4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4];
const base: ScrambleEvent = {
  course: { pars, si: Array.from({ length: 18 }, (_, i) => i + 1), tees: [{ id: "t", name: "T", rating: 72, slope: 113 }] },
  players: [{ id: "p", name: "P", index: 10 }],
  teams: [{ id: "a", name: "A", playerIds: ["p"] }],
  holes: "18",
  rounds: ["full"],
  scores: [{}],
};

describe("liveEvent", () => {
  it("puts the edited card and round mode into the event the engine scores", () => {
    const card = Array(18).fill(null) as (number | null)[];
    card[0] = 5; card[10] = 4;
    const ev = liveEvent(base, ["front"], { "0:a": card });
    expect(ev.rounds).toEqual(["front"]);
    const r = scrambleRound(ev, ev.teams[0], 0);
    expect(r.gross).toBe(5); // hole 11 is hidden by Front 9 only
    expect(r.thru).toBe(1);
    expect(base.scores).toEqual([{}]); // input untouched
  });
});

describe("sumHoles", () => {
  it("adds entered scores on the given holes", () => {
    const card = [4, null, 3, ...Array(15).fill(null)] as (number | null)[];
    expect(sumHoles(card, holesInPlay("18", "full").slice(0, 9))).toBe(7);
  });
});
