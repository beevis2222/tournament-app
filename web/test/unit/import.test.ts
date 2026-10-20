import { describe, it, expect } from "vitest";
import { parseDelimited, parseIdx, fixName, guessMap, parseImport, sheetGroups } from "@/lib/import/parse";

const TEES = ["Blue", "White"];
const run = (text: string, tees = TEES) => {
  const rows = parseDelimited(text);
  const g = guessMap(rows, tees);
  return { g, ...parseImport(rows, g.header, g.map, tees) };
};

describe("import parser", () => {
  it("detects a tab-separated header", () => {
    const g = guessMap(parseDelimited("Name\tIndex\tTee\nBob Smith\t12.4\tBlue"), TEES);
    expect(g.header).toBe(true);
    expect(g.map).toEqual(["name", "index", "tee"]);
  });

  it("parses handicap indexes", () => {
    expect(parseIdx("+2.1")).toBe(-2.1);
    expect(parseIdx("(12.4)")).toBe(12.4);
    expect(parseIdx("54.1")).toBeNull();
    expect(parseIdx("55")).toBeNull();
    expect(parseIdx("")).toBeNull();
  });

  it("flips Last, First names", () => {
    expect(fixName("Smith, Bob")).toBe("Bob Smith");
    expect(run("Name,Index\n\"Smith, Bob\",10.2").players[0].name).toBe("Bob Smith");
  });

  it("handles blank index and tee matching", () => {
    const r = run("Name,Index,Tee\nAl,,Blue Tees\nBo,9.0,Gold\nCy,5.0,white");
    expect(r.players[0]).toMatchObject({ nh: true, index: 0, teeName: "Blue", teeUnknown: false });
    expect(r.players[1]).toMatchObject({ teeName: null, teeUnknown: true });
    expect(r.players[2].teeName).toBe("White");
  });

  it("guesses columns without a header", () => {
    const g = guessMap(parseDelimited("Bob Smith, 12.4\nAl Jones, 8.0"), TEES);
    expect(g.header).toBe(false);
    expect(g.map).toEqual(["name", "index"]);
  });

  it("imports multi-name foursome sheets", () => {
    const r = run("Team,Player 1,Hcp 1,Player 2,Hcp 2\nA,Bob Smith,12.4,Al Jones,8\nB,Cy Lee,5,Di Fox,20");
    expect(r.multi).toBe(true);
    expect(r.players).toHaveLength(4);
    expect(r.players[0]).toMatchObject({ name: "Bob Smith", index: 12.4, group: "A", ghin: null });
    expect(sheetGroups(r.players).map(g => [g.label, g.players.length])).toEqual([["A", 2], ["B", 2]]);
  });

  it("skips rows with no name", () => {
    const r = run("Name,Index\nBob,10\n,12");
    expect(r.players).toHaveLength(1);
    expect(r.skipped).toEqual([{ row: 1, reason: "no name" }]);
  });
});
