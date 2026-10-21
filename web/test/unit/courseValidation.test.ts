import { describe, it, expect } from "vitest";
import { validateCourse, validateTee } from "@/lib/courseValidation";

const pars = Array(18).fill(4);
const si = Array.from({ length: 18 }, (_, i) => i + 1);

describe("validateCourse", () => {
  it("accepts a good course", () => expect(validateCourse({ name: "Main", pars, si })).toEqual({}));
  it("rejects pars outside 3-6", () => {
    expect(validateCourse({ name: "Main", pars: [...pars.slice(0, 17), 7], si }).pars).toBeDefined();
    expect(validateCourse({ name: "Main", pars: [2, ...pars.slice(1)], si }).pars).toBeDefined();
  });
  it("requires stroke index to be a permutation of 1-18", () => {
    const dup = [...si.slice(0, 17), 1];
    expect(validateCourse({ name: "Main", pars, si: dup }).si).toBe("Stroke index must use each number 1 to 18 once.");
    expect(validateCourse({ name: "Main", pars, si: [...si.slice(0, 17), 19] }).si).toBeDefined();
  });
  it("requires a name", () => expect(validateCourse({ name: " ", pars, si }).name).toBeDefined());
});

describe("validateTee", () => {
  const ok = { name: "White", rating: 71.2, slope: 130, pars: null, si: null };
  it("accepts a good tee", () => expect(validateTee(ok)).toEqual({}));
  it("bounds slope and rating", () => {
    expect(validateTee({ ...ok, slope: 156 }).slope).toBe("Slope must be between 55 and 155.");
    expect(validateTee({ ...ok, slope: 54 }).slope).toBeDefined();
    expect(validateTee({ ...ok, rating: 49.9 }).rating).toBeDefined();
    expect(validateTee({ ...ok, rating: 80.1 }).rating).toBeDefined();
    expect(validateTee({ ...ok, rating: 80, slope: 55 })).toEqual({});
  });
  it("validates per-tee pars and stroke index when given", () => {
    expect(validateTee({ ...ok, pars, si: [...si.slice(0, 17), 1] }).si).toBeDefined();
    expect(validateTee({ ...ok, pars, si })).toEqual({});
  });
});
