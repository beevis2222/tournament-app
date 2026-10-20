import { describe, it, expect } from "vitest";
import { checkStart, planMove, startMatchesType } from "@/lib/pairingEdit";

describe("checkStart", () => {
  it("accepts hole labels for shotgun and uppercases the letter", () => {
    expect(checkStart("shotgun", " 10a ")).toEqual({ ok: true, patch: { start_hole: "10A", start_time: null } });
    expect(checkStart("shotgun", "1")).toMatchObject({ ok: true });
    expect(checkStart("shotgun", "18B")).toMatchObject({ ok: true });
  });
  it("rejects bad hole labels", () => {
    for (const bad of ["", "0", "19", "25", "A", "1AB", "8:00"]) expect(checkStart("shotgun", bad).ok).toBe(false);
  });
  it("accepts HH:MM for tee times", () => {
    expect(checkStart("teetimes", "07:30")).toEqual({ ok: true, patch: { start_hole: null, start_time: "07:30" } });
    expect(checkStart("teetimes", "23:59")).toMatchObject({ ok: true });
  });
  it("rejects bad times", () => {
    for (const bad of ["", "7:30", "24:00", "08:60", "8am", "1"]) expect(checkStart("teetimes", bad).ok).toBe(false);
  });
});

describe("planMove", () => {
  it("moves the one existing link to the target", () => {
    expect(planMove(["a"], "b")).toEqual({ kind: "update", from: "a" });
  });
  it("adds a link when the team is in no live group", () => {
    expect(planMove([], "b")).toEqual({ kind: "insert" });
  });
  it("does nothing when already there", () => {
    expect(planMove(["b"], "b")).toEqual({ kind: "none" });
  });
  it("refuses when the team is already in two groups", () => {
    expect(planMove(["a", "b"], "b").kind).toBe("error");
  });
});

describe("startMatchesType", () => {
  it("spots a start left over from the other start type", () => {
    expect(startMatchesType("shotgun", { startHole: "1", startTime: null })).toBe(true);
    expect(startMatchesType("shotgun", { startHole: null, startTime: "08:00" })).toBe(false);
    expect(startMatchesType("teetimes", { startHole: null, startTime: "08:00" })).toBe(true);
    expect(startMatchesType("teetimes", { startHole: "3", startTime: null })).toBe(false);
  });
});
