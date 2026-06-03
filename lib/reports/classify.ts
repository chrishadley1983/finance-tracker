/**
 * Sign-aware classification of a transaction amount into income vs expense.
 *
 * This is the single source of truth shared by the monthly report's headline
 * totals and its income-vs-spending trend chart, so the two can never diverge
 * (they previously did: the chart summed raw amounts for income categories and
 * abs() for all non-income rows, while the headline was sign-aware).
 *
 * Rules — identical to the dashboard's `/api/transactions/summary`:
 *   - Excluded categories (transfers, credit-card payments) contribute nothing.
 *   - Income categories: only positive amounts count as income (a negative in
 *     an income category, e.g. a clawback, is ignored rather than subtracted).
 *   - Everything else, including uncategorised rows: only negative amounts
 *     count as spend (a refund credit in an expense category is ignored rather
 *     than inflating spend).
 */
export function classifyAmount(
  amount: number,
  isIncome: boolean,
  excluded: boolean,
): { income: number; expense: number } {
  if (excluded) return { income: 0, expense: 0 };
  if (isIncome) return { income: amount > 0 ? amount : 0, expense: 0 };
  return { income: 0, expense: amount < 0 ? Math.abs(amount) : 0 };
}
