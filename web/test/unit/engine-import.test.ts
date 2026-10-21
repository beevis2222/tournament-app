import { jsRound, payoutAmounts } from "@starter/scoring";

test("engine is importable from web", () => {
  expect(jsRound(7.5)).toBe(8);
  expect(
    payoutAmounts(
      [
        { id: "a", position: 1, eligible: true },
        { id: "b", position: 1, eligible: true },
        { id: "c", position: 1, eligible: true },
      ],
      [150, 100],
    ).get("a"),
  ).toBeCloseTo(83.333, 3);
});
