/** Gift-card style money: "$150" for whole dollars, otherwise cents ("$83.33", "$0.50"). */
export function formatMoney(n: number): string {
  // toPrecision first so 125.005 (stored as 125.00499999...) still rounds half up.
  const cents = Math.round(Number((n * 100).toPrecision(12)));
  const dollars = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest === 0 ? `$${dollars}` : `$${dollars}.${String(rest).padStart(2, "0")}`;
}
