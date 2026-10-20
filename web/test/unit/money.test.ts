import { formatMoney } from "@/lib/money";

test("whole dollars have no cents", () => {
  expect(formatMoney(150)).toBe("$150");
  expect(formatMoney(0)).toBe("$0");
});

test("cents show two places, rounded half up", () => {
  expect(formatMoney(83.3333)).toBe("$83.33");
  expect(formatMoney(0.5)).toBe("$0.50");
  expect(formatMoney(125.005)).toBe("$125.01");
  expect(formatMoney(83.335)).toBe("$83.34");
});
