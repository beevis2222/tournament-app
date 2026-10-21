import { describe, it, expect } from "vitest";
import { fetchAll } from "@/lib/db/paging";
import { isIsoDate, localDate } from "@/lib/dates";

const fake = (total: number, calls: [number, number][] = []) => async (from: number, to: number) => {
  calls.push([from, to]);
  const data = Array.from({ length: Math.max(0, Math.min(to + 1, total) - from) }, (_, i) => from + i);
  return { data, error: null };
};

describe("fetchAll", () => {
  it("returns all 2500 rows in pages of 1000 and stops on the short page", async () => {
    const calls: [number, number][] = [];
    const res = await fetchAll(fake(2500, calls));
    expect(res.data).toHaveLength(2500);
    expect(res.data?.[2499]).toBe(2499);
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });
  it("asks once more when the last page is exactly full", async () => {
    const calls: [number, number][] = [];
    const res = await fetchAll(fake(2000, calls));
    expect(res.data).toHaveLength(2000);
    expect(calls).toHaveLength(3);
  });
  it("handles an empty table", async () => {
    expect((await fetchAll(fake(0))).data).toEqual([]);
  });
  it("returns the error from any page", async () => {
    let n = 0;
    const res = await fetchAll(async () => (n++ ? { data: null, error: { message: "boom" } } : { data: Array(1000).fill(1), error: null }));
    expect(res.error?.message).toBe("boom");
  });
});

describe("localDate", () => {
  it("uses local year, month and day", () => {
    expect(localDate(new Date(2026, 4, 2, 23, 30))).toBe("2026-05-02");
    expect(localDate(new Date(2026, 0, 9, 0, 5))).toBe("2026-01-09");
  });
});

describe("isIsoDate", () => {
  it("accepts only real YYYY-MM-DD dates", () => {
    expect(isIsoDate("2026-10-20")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("dddd-dd-dd")).toBe(false);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });
});
