// @ts-check
/**
 * Pure helpers that turn raw observations (DB rows, payslip files) into the
 * shapes the engine and the drift report use. No IO here — the adapters in
 * plan/inputs/*.ts do the fetching and call these. Unit-tested with fixtures.
 */

/**
 * Latest balance per account name from wealth-snapshot rows.
 * @param {Array<{ date: string, balance: number|string, account: { name: string, type: string } | null }>} rows
 */
export function latestPerAccount(rows) {
  /** @type {Map<string, { name: string, type: string, balance: number, date: string }>} */
  const latest = new Map();
  for (const r of rows) {
    if (!r.account) continue;
    const prev = latest.get(r.account.name);
    if (!prev || r.date > prev.date) latest.set(r.account.name, { name: r.account.name, type: r.account.type, balance: Number(r.balance), date: r.date });
  }
  const accounts = Array.from(latest.values()).sort((x, y) => x.name.localeCompare(y.name));
  const asOf = accounts.reduce((m, x) => (x.date > m ? x.date : m), '');
  return { asOf: asOf || null, accounts };
}

/**
 * Map the latest account balances onto the assumptions' pots keys using
 * a.accounts.potsMap ({ accountName: 'pots.key' }). Returns the observed value
 * per key plus any mapped accounts that had no snapshot.
 * @param {any} a
 * @param {Array<{ name: string, balance: number, date: string }>} accounts
 */
export function potsFromSnapshots(a, accounts) {
  /** @type {Record<string, { value: number, date: string, account: string }>} */
  const observed = {};
  /** @type {string[]} */
  const missing = [];
  for (const [name, key] of Object.entries(a.accounts.potsMap)) {
    const acc = accounts.find((x) => x.name === name);
    if (acc) observed[/** @type {string} */ (key)] = { value: acc.balance, date: acc.date, account: name };
    else missing.push(name);
  }
  return { observed, missing };
}

/**
 * Classify an income-group transaction into a plan source.
 * @param {{ description: string, category: string | null, account: string | null, amount: number }} t
 * @returns {'abbySalary'|'abbyReimbursement'|'hbDrawings'|'hbSalesCredits'|'childBenefit'|'cottrellAnnual'|'contributions'|'gifts'|'chrisSideIncome'|'oneOff'|'other'}
 */
export function classifyIncomeSource(t) {
  const d = (t.description || '').toUpperCase();
  const c = (t.category || '').toLowerCase();
  if ((t.account || '').toLowerCase().includes('investment contributions')) return 'contributions';
  if (/ACCENTURE\s+UK/.test(d)) return Math.abs(t.amount) >= 1000 ? 'abbySalary' : 'abbyReimbursement';
  if (/BI WORLDWIDE/.test(d)) return 'abbyReimbursement';
  if (/HADLEY BRICKS/.test(d)) return 'hbDrawings';
  if (/STRIPE PAYMENTS|SHOPIFY|EBAY COMMERCE/.test(d)) return 'hbSalesCredits';
  if (/CHILD BENEFIT/.test(d)) return 'childBenefit';
  if (/COTTRELL/.test(d)) return 'cottrellAnnual';
  if (/PEOPLE FOR RESEARC|RESPONDENT|USER INTERVIEWS|MERCOR|PROLIFIC/.test(d)) return 'chrisSideIncome';
  if (/CHQ IN|TAX REBATE|HMRC REPAY/.test(d)) return 'oneOff';
  if (c === 'gift in' || /HADLEY P&SA|BIRTHDAY/.test(d)) return 'gifts';
  if (c === 'abby income') return 'abbyReimbursement';
  if (c === 'chris income') return 'hbDrawings';
  return 'other';
}

/**
 * Sum income-group transactions by source over a window.
 * @param {Array<{ date: string, amount: number, description: string, category: string | null, account: string | null }>} txns
 */
export function incomeBySource(txns) {
  /** @type {Record<string, number>} */
  const bySource = {};
  let total = 0;
  for (const t of txns) { const s = classifyIncomeSource(t); bySource[s] = (bySource[s] ?? 0) + t.amount; total += t.amount; }
  const abby = (bySource.abbySalary ?? 0) + (bySource.abbyReimbursement ?? 0);
  const hb = (bySource.hbDrawings ?? 0) + (bySource.hbSalesCredits ?? 0);
  const spendable = total - (bySource.contributions ?? 0);
  const recurring = spendable - (bySource.oneOff ?? 0) - (bySource.gifts ?? 0);
  return { bySource, total, abbyTakeHome: abby, hbDrawings: hb, childBenefit: bySource.childBenefit ?? 0, cottrell: bySource.cottrellAnnual ?? 0, sideIncome: bySource.chrisSideIncome ?? 0, contributions: bySource.contributions ?? 0, spendable, recurring };
}

/**
 * Validate a payslip observation file.
 * @param {any} s
 * @returns {string[]} problems
 */
export function validatePayslip(s) {
  const p = [];
  if (!/^\d{4}\/\d{2}$/.test(String(s.taxYear))) p.push('taxYear must look like 2026/27');
  if (!Number.isInteger(s.taxMonth) || s.taxMonth < 1 || s.taxMonth > 12) p.push('taxMonth must be 1..12');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s.payDate))) p.push('payDate must be YYYY-MM-DD');
  for (const k of ['basicMonthly', 'taxablePayMonthly', 'ytdTaxable', 'netMonthly']) if (typeof s[k] !== 'number' || !(s[k] > 0)) p.push(`${k} must be a positive number`);
  if (typeof s.avcPct !== 'number' || s.avcPct < 0 || s.avcPct > 100) p.push('avcPct must be 0..100');
  if (typeof s.ytdTaxable === 'number' && typeof s.taxablePayMonthly === 'number' && s.taxMonth && s.ytdTaxable < s.taxablePayMonthly * 0.9) p.push('ytdTaxable is smaller than one month of taxable pay');
  return p;
}

/**
 * Drift between what the assumptions say and what was observed. Levels follow
 * plan/ARCHITECTURE.md §4: pots ±3% AMBER / ±10% RED; run-rate over the plan
 * line by >£2k AMBER / >£8k RED; payslip age >45d AMBER / >75d RED; payslip
 * basic ≠ assumptions → RED (the assumption is derived from the payslip).
 * @param {any} a
 * @param {{ pots?: { observed: Record<string, { value: number, date: string, account: string }> }, runRate?: { trailing12moSpend: number }, payslip?: any, rungs?: any[] }} obs
 * @param {string} today YYYY-MM-DD
 */
export function driftReport(a, obs, today) {
  /** @type {Array<{ level: 'OK'|'AMBER'|'RED', item: string, detail: string }>} */
  const out = [];
  const flag = (/** @type {'OK'|'AMBER'|'RED'} */ level, /** @type {string} */ item, /** @type {string} */ detail) => out.push({ level, item, detail });
  const get = (/** @type {string} */ key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), a);
  if (obs.pots) {
    for (const [key, o] of Object.entries(obs.pots.observed)) {
      const assumed = Number(get(key));
      const rel = assumed ? Math.abs(o.value - assumed) / assumed : 1;
      const abs = Math.abs(o.value - assumed);
      const level = rel > 0.10 ? 'RED' : rel > 0.03 || abs > 15_000 ? 'AMBER' : 'OK';
      flag(level, key, `assumed ${assumed.toLocaleString('en-GB')} vs snapshot ${o.value.toLocaleString('en-GB')} (${o.date}, ${(rel * 100).toFixed(1)}%)`);
    }
  }
  if (obs.runRate) {
    const over = obs.runRate.trailing12moSpend - a.spend.planLine;
    flag(over > 8_000 ? 'RED' : over > 2_000 ? 'AMBER' : 'OK', 'spend.planLine', `trailing-12m spend ${Math.round(obs.runRate.trailing12moSpend).toLocaleString('en-GB')} vs plan line ${a.spend.planLine.toLocaleString('en-GB')} (${over >= 0 ? '+' : ''}${Math.round(over).toLocaleString('en-GB')})`);
  }
  if (obs.payslip) {
    const days = Math.floor((Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10)) - Date.UTC(+obs.payslip.payDate.slice(0, 4), +obs.payslip.payDate.slice(5, 7) - 1, +obs.payslip.payDate.slice(8, 10))) / 86_400_000);
    flag(days > 75 ? 'RED' : days > 45 ? 'AMBER' : 'OK', 'payslip age', `newest payslip ${obs.payslip.payDate} is ${days} days old`);
    const basicAnnual = obs.payslip.basicMonthly * 12;
    flag(Math.abs(basicAnnual - a.payslip.basicAnnual) > 1 ? 'RED' : 'OK', 'payslip.basicAnnual', `assumption ${a.payslip.basicAnnual.toLocaleString('en-GB')} vs payslip ${basicAnnual.toLocaleString('en-GB')}`);
  }
  if (obs.rungs) {
    const bought = obs.rungs.filter((r) => r.status === 'bought');
    const cost = bought.reduce((s, r) => s + Number(r.cost ?? 0), 0);
    flag('OK', 'ladder rungs', `${bought.length} of ${obs.rungs.length} bought, cost ${Math.round(cost).toLocaleString('en-GB')} of budget ${Math.round(a.ladder.budgetReal).toLocaleString('en-GB')}`);
  }
  const worst = out.some((x) => x.level === 'RED') ? 'RED' : out.some((x) => x.level === 'AMBER') ? 'AMBER' : 'GREEN';
  return { verdict: worst, items: out };
}
