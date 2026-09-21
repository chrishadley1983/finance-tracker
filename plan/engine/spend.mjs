// @ts-check
/**
 * Spending run-rate and pot buckets. Pure; the plan line, excluded categories
 * and bucket map come from the assumptions object `a`.
 * Ports of lib/plan/spend.ts and lib/plan/buckets.ts.
 */

/**
 * Trailing spend, sign-aware (negative = expense), excluding income, excluded
 * categories and the plan's one-off/business/reimbursed categories. Gross
 * debits only — refunds and credits are not netted (the cockpit definition).
 * @param {any} a
 * @param {Array<{ amount: number, category: { name: string, is_income: boolean, exclude_from_totals: boolean } | null }>} txns
 */
export function computeRunRate(a, txns) {
  let spend = 0, excluded = 0;
  for (const t of txns) {
    const c = t.category;
    if (!c || c.exclude_from_totals || c.is_income) continue;
    if (t.amount >= 0) continue;
    const x = Math.abs(t.amount);
    if (a.spend.excludedCategories.includes(c.name)) excluded += x; else spend += x;
  }
  return { trailing12moSpend: spend, vsPlanLine: spend - a.spend.planLine, excludedTotal: excluded };
}

/** @param {any} a @param {string} name @param {string} type */
export function bucketFor(a, name, type) {
  const mapped = a.accounts.bucketMap[name];
  if (mapped) return mapped;
  if (type === 'pension') return name.toLowerCase().includes('abby') ? 'abbyPension' : 'chrisPension';
  if (['property', 'tracking', 'credit', 'other'].includes(type)) return 'excluded';
  return 'accessible';
}

/**
 * Latest balance per account, summed into buckets. Falls back to the
 * assumptions' pots when there are no snapshots at all.
 * @param {any} a
 * @param {Array<{ date: string, balance: number, account: { name: string, type: string } | null }>} snapshots
 */
export function bucketTotals(a, snapshots) {
  /** @type {Map<string, { date: string, balance: number, account: { name: string, type: string } }>} */
  const latest = new Map();
  for (const s of snapshots) {
    if (!s.account) continue;
    const prev = latest.get(s.account.name);
    if (!prev || s.date > prev.date) latest.set(s.account.name, /** @type {any} */ (s));
  }
  if (latest.size === 0) {
    const { nonPension, chrisPension, abbyPension } = a.pots;
    return { accessible: nonPension, chrisPension, abbyPension, total: nonPension + chrisPension + abbyPension, asOf: null, isBaseline: true };
  }
  const totals = { accessible: 0, chrisPension: 0, abbyPension: 0 };
  let asOf = '';
  for (const s of Array.from(latest.values())) {
    const b = bucketFor(a, s.account.name, s.account.type);
    if (b === 'excluded') continue;
    totals[/** @type {'accessible'|'chrisPension'|'abbyPension'} */ (b)] += Number(s.balance);
    if (s.date > asOf) asOf = s.date;
  }
  return { ...totals, total: totals.accessible + totals.chrisPension + totals.abbyPension, asOf: asOf || null, isBaseline: false };
}
