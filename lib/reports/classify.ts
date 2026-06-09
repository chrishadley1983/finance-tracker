/**
 * Sign-aware classification of a transaction amount into income vs expense.
 *
 * Single source of truth shared by the report headline, the trend chart, the
 * dashboard `/api/transactions/summary` and the reporting RPCs.
 *
 * Rules:
 *   - Excluded categories (transfers, credit-card payments) contribute nothing.
 *   - Income categories: only positive amounts count as income (a negative, e.g.
 *     a clawback, is ignored rather than subtracted).
 *   - A KNOWN expense category NETS: spend = -amount, so debits add and refund
 *     credits subtract. A category can go negative in a period when refunds
 *     exceed spend (a genuine net refund — e.g. leftover holiday FX converted
 *     back). `isCategorised=true` (the default) selects this path.
 *   - An UNCATEGORISED row (`isCategorised=false`) counts debits as spend and
 *     ignores credits — we can't assume an unreviewed credit is a refund.
 */
export function classifyAmount(
  amount: number,
  isIncome: boolean,
  excluded: boolean,
  isCategorised: boolean = true,
): { income: number; expense: number } {
  if (excluded) return { income: 0, expense: 0 };
  if (isIncome) return { income: amount > 0 ? amount : 0, expense: 0 };
  if (!isCategorised) return { income: 0, expense: amount < 0 ? Math.abs(amount) : 0 };
  return { income: 0, expense: -amount };
}
