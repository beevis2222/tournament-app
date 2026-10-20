import { describe, expect, it } from "vitest";
import { newHoleSync, saveFinished, wantValue } from "@/lib/cardEntry";

describe("hole save bookkeeping", () => {
  it("sends the correction after an in-flight save: type 4, save pending, clear -> sends null", () => {
    let s = newHoleSync(null);
    let step = wantValue(s, 4);
    expect(step.send).toEqual({ value: 4 });
    s = step.state;
    step = wantValue(s, null); // cleared while the 4 is still saving
    expect(step.send).toBeNull();
    s = step.state;
    step = saveFinished(s, 4, true);
    expect(step.send).toEqual({ value: null });
    s = step.state;
    step = saveFinished(s, null, true);
    expect(step.send).toBeNull();
    expect(step.state).toEqual({ confirmed: null, desired: null, sending: false });
  });

  it("sends the latest value: type 4, pending, type 5 -> sends 5", () => {
    let s = wantValue(newHoleSync(null), 4).state;
    s = wantValue(s, 5).state;
    const step = saveFinished(s, 4, true);
    expect(step.send).toEqual({ value: 5 });
  });

  it("does nothing when the value is unchanged", () => {
    expect(wantValue(newHoleSync(3), 3).send).toBeNull();
  });

  it("a failed save sends nothing by itself; a retry sends the latest", () => {
    let s = wantValue(newHoleSync(null), 4).state;
    const failed = saveFinished(s, 4, false);
    expect(failed.send).toBeNull();
    s = failed.state;
    expect(wantValue(s, 4).send).toEqual({ value: 4 });
  });

  it("back to the confirmed value while pending sends the value again only if it differs", () => {
    let s = wantValue(newHoleSync(2), 4).state;
    s = wantValue(s, 2).state;
    expect(saveFinished(s, 4, true).send).toEqual({ value: 2 });
  });
});
